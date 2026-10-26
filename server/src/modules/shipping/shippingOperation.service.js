'use strict';

const { Op } = require('sequelize');
const {
    sequelize,
    ShippingOperation,
    Shipment,
    ShippingProvider,
    Fulfillment,
} = require('../index');
const { resolveProvider } = require('./providers');
const { resolveDispatchOrigin } = require('./shipping.service');
const logger = require('../../utils/logger');

const MAX_LOCK_AGE_MS = 10 * 60 * 1000;

const nextAttemptAt = (attempt) => new Date(Date.now() + Math.min(60, 2 ** Math.max(0, attempt)) * 60 * 1000);

const enqueueCreateOperation = async ({ shipment, provider, requestPayload, transaction }) => {
    const idempotencyKey = `${provider.code}:${shipment.id}:create`;
    const [operation] = await ShippingOperation.findOrCreate({
        where: { idempotencyKey },
        defaults: {
            shipmentId: shipment.id,
            providerId: provider.id,
            operationType: 'create',
            idempotencyKey,
            status: 'queued',
            nextAttemptAt: new Date(),
            requestPayload,
        },
        transaction,
    });
    return operation;
};

const claimOperation = async (operationId, transaction) => {
    const operation = await ShippingOperation.findByPk(operationId, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
    });
    if (!operation) return null;

    const lockedTooLong = operation.lockedAt && Date.now() - new Date(operation.lockedAt).getTime() > MAX_LOCK_AGE_MS;
    if (['completed', 'failed', 'cancelled'].includes(operation.status) || (operation.status === 'processing' && !lockedTooLong)) {
        return null;
    }
    if (Number(operation.attempts || 0) >= Number(operation.maxAttempts || 8)) {
        await operation.update({ status: 'failed', lastError: operation.lastError || 'Maximum retry attempts reached' }, { transaction });
        return null;
    }

    await operation.update({
        status: 'processing',
        attempts: Number(operation.attempts || 0) + 1,
        lockedAt: new Date(),
        lastError: null,
    }, { transaction });
    return operation;
};

const processOperation = async (operationId) => {
    const claimed = await sequelize.transaction(async (t) => claimOperation(operationId, t));
    if (!claimed) return { success: false, skipped: true };

    const operation = claimed.get({ plain: true });
    let providerResult;

    try {
        const provider = await ShippingProvider.findByPk(operation.providerId);
        if (!provider || !provider.enabled) throw new Error('Shipping provider is missing or disabled');

        const adapter = resolveProvider(provider);
        const dispatchOrigin = await resolveDispatchOrigin(provider);
        if (operation.requestPayload?.shipment) {
            operation.requestPayload.shipment.pickupLocationName = dispatchOrigin.pickupLocationName;
            operation.requestPayload.shipment.pickupPincode = dispatchOrigin.pincode;
        }

        // Reconcile before retrying (Edge Case 9): If prior attempt timed out, check if shipment was already created in carrier
        if (typeof adapter.checkShipmentExists === 'function') {
            const existing = await adapter.checkShipmentExists({
                providerRequestId: operation.requestPayload.shipment?.providerRequestId,
                orderNumber: operation.requestPayload.order?.orderNumber,
                courierCompanyId: operation.requestPayload.shipment?.courierCompanyId,
                pincode: operation.requestPayload.address?.postalCode,
                pickupPincode: dispatchOrigin.pincode || null,
                weightGrams: operation.requestPayload.shipment?.actualWeightGrams || 500,
                declaredValue: operation.requestPayload.order?.subtotal || 0,
                paymentMode: operation.requestPayload.order?.paymentMethod === 'cod' ? 'cod' : 'prepaid',
                lengthCm: operation.requestPayload.shipment?.lengthCm,
                breadthCm: operation.requestPayload.shipment?.breadthCm,
                heightCm: operation.requestPayload.shipment?.heightCm,
            });
            if (existing && existing.awbCode) {
                providerResult = existing;
            }
        }

        if (!providerResult) {
            if (typeof adapter.getServiceability === 'function') {
                const serviceability = await adapter.getServiceability({
                    pincode: operation.requestPayload.address?.postalCode,
                    pickupPincode: dispatchOrigin.pincode || null,
                    weightGrams: operation.requestPayload.shipment?.actualWeightGrams || 500,
                    declaredValue: operation.requestPayload.order?.subtotal || 0,
                    paymentMode: operation.requestPayload.order?.paymentMethod === 'cod' ? 'cod' : 'prepaid',
                    lengthCm: operation.requestPayload.shipment?.lengthCm,
                    breadthCm: operation.requestPayload.shipment?.breadthCm,
                    heightCm: operation.requestPayload.shipment?.heightCm,
                    courierCompanyId: operation.requestPayload.shipment?.courierCompanyId,
                });
                if (!serviceability.serviceable || (operation.requestPayload.order?.paymentMethod === 'cod' && !serviceability.codAvailable)) {
                    throw new Error(`Shipping provider cannot fulfill this shipment: ${serviceability.reason || 'unserviceable destination'}`);
                }
            }
            providerResult = await adapter.createShipment(operation.requestPayload);
        }

        await sequelize.transaction(async (t) => {
            const shipment = await Shipment.findByPk(operation.shipmentId, { transaction: t, lock: t.LOCK.UPDATE });
            if (!shipment) throw new Error('Shipment no longer exists');

            await shipment.update({
                providerOrderId: providerResult.providerOrderId || shipment.providerOrderId,
                providerShipmentId: providerResult.providerShipmentId || shipment.providerShipmentId,
                awb: providerResult.awbCode || shipment.awb,
                trackingNumber: providerResult.awbCode || shipment.trackingNumber,
                trackingUrl: providerResult.trackingUrl || shipment.trackingUrl,
                courierName: providerResult.courierName || shipment.courierName || provider.name,
                labelUrl: providerResult.label || shipment.labelUrl,
                manifestUrl: providerResult.manifest || shipment.manifestUrl,
                invoiceUrl: providerResult.invoice || shipment.invoiceUrl,
                providerState: 'completed',
                lastProviderError: null,
                rawResponse: providerResult.rawResponse || shipment.rawResponse,
            }, { transaction: t });

            if (shipment.fulfillmentId) {
                await Fulfillment.update({
                    trackingNumber: providerResult.awbCode || shipment.trackingNumber,
                    courier: providerResult.courierName || provider.name,
                }, { where: { id: shipment.fulfillmentId }, transaction: t });
            }

            await ShippingOperation.update({
                status: 'completed',
                completedAt: new Date(),
                lockedAt: null,
                responsePayload: providerResult.rawResponse || providerResult,
                lastError: null,
            }, { where: { id: operation.id }, transaction: t });
        });

        return { success: true, operationId: operation.id, result: providerResult };
    } catch (error) {
        const attempts = Number(operation.attempts || 1);
        const terminal = attempts >= Number(operation.maxAttempts || 8);
        const message = error.response?.data?.message || error.message;

        await sequelize.transaction(async (t) => {
            await Shipment.update({
                providerState: terminal ? 'failed' : 'retrying',
                lastProviderError: message,
            }, { where: { id: operation.shipmentId }, transaction: t });
            await ShippingOperation.update({
                status: terminal ? 'failed' : 'queued',
                nextAttemptAt: terminal ? null : nextAttemptAt(attempts),
                lockedAt: null,
                lastError: message,
            }, { where: { id: operation.id }, transaction: t });
        });

        logger.error('[shippingOperation] Provider operation failed', {
            operationId: operation.id,
            shipmentId: operation.shipmentId,
            attempt: attempts,
            terminal,
            error: message,
        });
        return { success: false, operationId: operation.id, error: message, terminal };
    }
};

const processQueued = async ({ limit = 20 } = {}) => {
    const operations = await ShippingOperation.findAll({
        where: {
            status: 'queued',
            [Op.or]: [
                { nextAttemptAt: null },
                { nextAttemptAt: { [Op.lte]: new Date() } },
            ],
        },
        order: [['createdAt', 'ASC']],
        limit,
        attributes: ['id'],
    });

    let processed = 0;
    for (const operation of operations) {
        await processOperation(operation.id);
        processed += 1;
    }
    return processed;
};

const listFailedOperations = async ({ page = 1, limit = 20, status = 'failed' } = {}) => {
    const offset = (page - 1) * limit;
    const statusFilter = status === 'failed' ? ['failed']
        : status === 'active' ? ['queued', 'processing']
            : ['queued', 'processing', 'failed'];
    const { count, rows } = await ShippingOperation.findAndCountAll({
        where: {
            status: { [Op.in]: statusFilter },
        },
        include: [
            {
                model: Shipment,
                as: 'shipment',
                include: [
                    {
                        model: require('../index').Order,
                        as: 'order',
                        attributes: ['id', 'orderNumber', 'total', 'status'],
                    },
                ],
            },
            {
                model: ShippingProvider,
                as: 'provider',
                attributes: ['id', 'name', 'code'],
            },
        ],
        order: [['updatedAt', 'DESC']],
        limit,
        offset,
    });

    return {
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        operations: rows,
    };
};

const retryOperation = async (operationId) => {
    await sequelize.transaction(async (t) => {
        let operation = await ShippingOperation.findByPk(operationId, { transaction: t });
        if (!operation) throw new Error('Shipping operation not found');

        if (operation.status === 'completed') {
            throw new Error('Completed shipping operations cannot be retried.');
        }

        const isLocked = operation.lockedAt && (Date.now() - new Date(operation.lockedAt).getTime() <= MAX_LOCK_AGE_MS);
        if (operation.status === 'processing' && isLocked) {
            throw new Error('Shipping operation is currently processing and cannot be retried.');
        }

        if (operation.status !== 'failed' && operation.status !== 'queued' && !(operation.status === 'processing' && !isLocked)) {
            throw new Error(`Cannot retry shipping operation with status: ${operation.status}`);
        }

        const shipment = await Shipment.findByPk(operation.shipmentId, { transaction: t, lock: t?.LOCK?.UPDATE });
        // Cancellation locks the shipment before its operation. Use that order
        // here too, then recheck the operation after waiting for either lock.
        operation = await ShippingOperation.findByPk(operationId, { transaction: t, lock: t?.LOCK?.UPDATE });
        const refreshedLockActive = operation?.lockedAt && Date.now() - new Date(operation.lockedAt).getTime() <= MAX_LOCK_AGE_MS;
        if (!operation || (!['failed', 'queued'].includes(operation.status) && !(operation.status === 'processing' && !refreshedLockActive))) {
            throw new Error('Shipping operation changed while waiting for retry. Refresh and try again.');
        }
        if (!shipment || shipment.status === 'cancelled' || ['cancelled', 'cancelling'].includes(shipment.providerState)) {
            throw new Error('Cancelled or missing shipments cannot be booked again. Create a replacement shipment.');
        }
        const requestPayload = {
            ...operation.requestPayload,
            shipment: {
                ...operation.requestPayload?.shipment,
                actualWeightGrams: shipment.actualWeightGrams,
                volumetricWeightGrams: shipment.volumetricWeightGrams,
                lengthCm: shipment.lengthCm,
                breadthCm: shipment.breadthCm,
                heightCm: shipment.heightCm,
            },
        };

        await operation.update({
            status: 'queued',
            maxAttempts: Math.max(Number(operation.maxAttempts || 8), Number(operation.attempts || 0) + 8),
            requestPayload,
            nextAttemptAt: new Date(),
            lockedAt: null,
            lastError: null,
        }, { transaction: t });
    });

    return module.exports.processOperation(operationId);
};

module.exports = {
    enqueueCreateOperation,
    processOperation,
    processQueued,
    listFailedOperations,
    retryOperation,
};
