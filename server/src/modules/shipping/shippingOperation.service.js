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
        lock: transaction.LOCK.UPDATE,
    });
    if (!operation) return null;

    const lockedTooLong = operation.lockedAt && Date.now() - new Date(operation.lockedAt).getTime() > MAX_LOCK_AGE_MS;
    if (operation.status === 'completed' || operation.status === 'failed' || (operation.status === 'processing' && !lockedTooLong)) {
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
        if (typeof adapter.getServiceability === 'function') {
            const serviceability = await adapter.getServiceability({
                pincode: operation.requestPayload.address?.postalCode,
                pickupPincode: provider.settings?.pickupPincode || null,
                weightGrams: operation.requestPayload.shipment?.actualWeightGrams || 500,
                paymentMode: operation.requestPayload.order?.paymentMethod === 'cod' ? 'cod' : 'prepaid',
            });
            if (!serviceability.serviceable || (operation.requestPayload.order?.paymentMethod === 'cod' && !serviceability.codAvailable)) {
                throw new Error(`Shipping provider cannot fulfill this shipment: ${serviceability.reason || 'unserviceable destination'}`);
            }
        }
        providerResult = await adapter.createShipment(operation.requestPayload);

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

module.exports = {
    enqueueCreateOperation,
    processOperation,
    processQueued,
};
