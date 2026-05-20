'use strict';

const { Transaction } = require('sequelize');
const {
  Product,
  ProductVariant,
  InventoryTransaction,
} = require('../index');
const AppError = require('../../utils/AppError');

const assertTransaction = (transaction) => {
  if (!transaction) {
    throw new AppError('INTERNAL_SERVER_ERROR', 500, 'Inventory operations must run inside a transaction');
  }
};

const toPositiveInt = (value, fieldName = 'qty') => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError('VALIDATION_ERROR', 400, `${fieldName} must be a positive integer`);
  }
  return parsed;
};

const createLedgerEntry = async ({
  type,
  qty,
  productId,
  variantId = null,
  orderId = null,
  orderItemId = null,
  beforeStock = null,
  afterStock = null,
  beforeReserved = null,
  afterReserved = null,
  createdBy = null,
  metadata = {},
  transaction,
}) => {
  await InventoryTransaction.create({
    type,
    qty,
    productId,
    variantId,
    orderId,
    orderItemId,
    beforeStock,
    afterStock,
    beforeReserved,
    afterReserved,
    createdBy,
    metadata,
  }, { transaction });
};

const syncParentProductFromVariants = async (productId, transaction) => {
  if (!productId) return null;
  assertTransaction(transaction);

  const product = await Product.findByPk(productId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!product) return null;

  const [stockSum, reservedSum] = await Promise.all([
    ProductVariant.sum('stockQty', {
      where: { productId, isActive: true },
      transaction,
    }),
    ProductVariant.sum('reservedQty', {
      where: { productId, isActive: true },
      transaction,
    }),
  ]);

  const nextReserved = Math.max(Number(reservedSum || 0), 0);
  const nextQuantity = Math.max(Number(stockSum || 0), nextReserved);

  if (Number(product.quantity || 0) !== nextQuantity || Number(product.reservedQty || 0) !== nextReserved) {
    await product.update({
      quantity: nextQuantity,
      reservedQty: nextReserved,
    }, { transaction });
  }

  return {
    productId,
    quantity: nextQuantity,
    reservedQty: nextReserved,
  };
};

const reserve = async ({
  productId,
  variantId = null,
  qty,
  orderId = null,
  orderItemId = null,
  createdBy = null,
  metadata = {},
  transaction,
  syncParent = true,
}) => {
  assertTransaction(transaction);
  const quantity = toPositiveInt(qty);

  if (variantId) {
    const variant = await ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 404, 'Selected variant not found');
    }

    const beforeStock = Number(variant.stockQty || 0);
    const beforeReserved = Number(variant.reservedQty || 0);
    const available = Math.max(beforeStock - beforeReserved, 0);
    if (available < quantity) {
      throw new AppError('CONFLICT', 409, 'Insufficient variant stock');
    }

    const afterReserved = beforeReserved + quantity;
    if (afterReserved > beforeStock) {
      throw new AppError('CONFLICT', 409, 'Invalid reserve operation for variant');
    }

    await variant.update({ reservedQty: afterReserved }, { transaction });

    await createLedgerEntry({
      type: 'RESERVE',
      qty: quantity,
      productId,
      variantId,
      orderId,
      orderItemId,
      beforeStock,
      afterStock: beforeStock,
      beforeReserved,
      afterReserved,
      createdBy,
      metadata,
      transaction,
    });

    if (syncParent) await syncParentProductFromVariants(productId, transaction);

    return {
      productId,
      variantId,
      reservedDelta: quantity,
      stockDelta: 0,
      beforeStock,
      afterStock: beforeStock,
      beforeReserved,
      afterReserved,
    };
  }

  const product = await Product.findByPk(productId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  const beforeStock = Number(product.quantity || 0);
  const beforeReserved = Number(product.reservedQty || 0);
  const available = Math.max(beforeStock - beforeReserved, 0);
  if (available < quantity) {
    throw new AppError('CONFLICT', 409, `Insufficient stock for product ${product.name}`);
  }

  const afterReserved = beforeReserved + quantity;
  if (afterReserved > beforeStock) {
    throw new AppError('CONFLICT', 409, 'Invalid reserve operation for product');
  }

  await product.update({ reservedQty: afterReserved }, { transaction });

  await createLedgerEntry({
    type: 'RESERVE',
    qty: quantity,
    productId,
    variantId: null,
    orderId,
    orderItemId,
    beforeStock,
    afterStock: beforeStock,
    beforeReserved,
    afterReserved,
    createdBy,
    metadata,
    transaction,
  });

  return {
    productId,
    variantId: null,
    reservedDelta: quantity,
    stockDelta: 0,
    beforeStock,
    afterStock: beforeStock,
    beforeReserved,
    afterReserved,
  };
};

const release = async ({
  productId,
  variantId = null,
  qty,
  orderId = null,
  orderItemId = null,
  createdBy = null,
  metadata = {},
  transaction,
  syncParent = true,
}) => {
  assertTransaction(transaction);
  const quantity = toPositiveInt(qty);

  if (variantId) {
    const variant = await ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 404, 'Selected variant not found');
    }

    const beforeStock = Number(variant.stockQty || 0);
    const beforeReserved = Number(variant.reservedQty || 0);
    const releasedQty = Math.min(beforeReserved, quantity);
    if (releasedQty <= 0) {
      return {
        productId,
        variantId,
        reservedDelta: 0,
        stockDelta: 0,
        beforeStock,
        afterStock: beforeStock,
        beforeReserved,
        afterReserved: beforeReserved,
      };
    }

    const afterReserved = beforeReserved - releasedQty;
    await variant.update({ reservedQty: afterReserved }, { transaction });

    await createLedgerEntry({
      type: 'RELEASE',
      qty: releasedQty,
      productId,
      variantId,
      orderId,
      orderItemId,
      beforeStock,
      afterStock: beforeStock,
      beforeReserved,
      afterReserved,
      createdBy,
      metadata: {
        ...metadata,
        requestedQty: quantity,
      },
      transaction,
    });

    if (syncParent) await syncParentProductFromVariants(productId, transaction);

    return {
      productId,
      variantId,
      reservedDelta: -releasedQty,
      stockDelta: 0,
      beforeStock,
      afterStock: beforeStock,
      beforeReserved,
      afterReserved,
      releasedQty,
    };
  }

  const product = await Product.findByPk(productId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  const beforeStock = Number(product.quantity || 0);
  const beforeReserved = Number(product.reservedQty || 0);
  const releasedQty = Math.min(beforeReserved, quantity);
  if (releasedQty <= 0) {
    return {
      productId,
      variantId: null,
      reservedDelta: 0,
      stockDelta: 0,
      beforeStock,
      afterStock: beforeStock,
      beforeReserved,
      afterReserved: beforeReserved,
    };
  }

  const afterReserved = beforeReserved - releasedQty;
  await product.update({ reservedQty: afterReserved }, { transaction });

  await createLedgerEntry({
    type: 'RELEASE',
    qty: releasedQty,
    productId,
    variantId: null,
    orderId,
    orderItemId,
    beforeStock,
    afterStock: beforeStock,
    beforeReserved,
    afterReserved,
    createdBy,
    metadata: {
      ...metadata,
      requestedQty: quantity,
    },
    transaction,
  });

  return {
    productId,
    variantId: null,
    reservedDelta: -releasedQty,
    stockDelta: 0,
    beforeStock,
    afterStock: beforeStock,
    beforeReserved,
    afterReserved,
    releasedQty,
  };
};

const shipDeduct = async ({
  productId,
  variantId = null,
  qty,
  orderId = null,
  orderItemId = null,
  createdBy = null,
  metadata = {},
  transaction,
  syncParent = true,
}) => {
  assertTransaction(transaction);
  const quantity = toPositiveInt(qty);

  if (variantId) {
    const variant = await ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 404, `Variant ${variantId} not found during stock deduction`);
    }

    const beforeStock = Number(variant.stockQty || 0);
    const beforeReserved = Number(variant.reservedQty || 0);
    if (beforeStock < quantity || beforeReserved < quantity) {
      throw new AppError('CONFLICT', 409, `Stock deduction failed for variant ${variant.sku}: insufficient quantity or reserved stock.`);
    }

    const afterStock = beforeStock - quantity;
    const afterReserved = beforeReserved - quantity;
    await variant.update({
      stockQty: afterStock,
      reservedQty: afterReserved,
    }, { transaction });

    await createLedgerEntry({
      type: 'SHIP',
      qty: quantity,
      productId,
      variantId,
      orderId,
      orderItemId,
      beforeStock,
      afterStock,
      beforeReserved,
      afterReserved,
      createdBy,
      metadata,
      transaction,
    });

    if (syncParent) await syncParentProductFromVariants(productId, transaction);

    return {
      productId,
      variantId,
      reservedDelta: -quantity,
      stockDelta: -quantity,
      beforeStock,
      afterStock,
      beforeReserved,
      afterReserved,
    };
  }

  const product = await Product.findByPk(productId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, `Product ${productId} not found during stock deduction`);
  }

  const beforeStock = Number(product.quantity || 0);
  const beforeReserved = Number(product.reservedQty || 0);
  if (beforeStock < quantity || beforeReserved < quantity) {
    throw new AppError('CONFLICT', 409, `Stock deduction failed for "${product.name}": insufficient quantity or reserved stock.`);
  }

  const afterStock = beforeStock - quantity;
  const afterReserved = beforeReserved - quantity;
  await product.update({
    quantity: afterStock,
    reservedQty: afterReserved,
  }, { transaction });

  await createLedgerEntry({
    type: 'SHIP',
    qty: quantity,
    productId,
    variantId: null,
    orderId,
    orderItemId,
    beforeStock,
    afterStock,
    beforeReserved,
    afterReserved,
    createdBy,
    metadata,
    transaction,
  });

  return {
    productId,
    variantId: null,
    reservedDelta: -quantity,
    stockDelta: -quantity,
    beforeStock,
    afterStock,
    beforeReserved,
    afterReserved,
  };
};

const restockReturn = async ({
  productId,
  variantId = null,
  qty,
  orderId = null,
  orderItemId = null,
  createdBy = null,
  metadata = {},
  transaction,
  syncParent = true,
}) => {
  assertTransaction(transaction);
  const quantity = toPositiveInt(qty);

  if (variantId) {
    const variant = await ProductVariant.findOne({
      where: { id: variantId, productId },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!variant) {
      throw new AppError('NOT_FOUND', 404, 'Selected variant not found');
    }

    const beforeStock = Number(variant.stockQty || 0);
    const beforeReserved = Number(variant.reservedQty || 0);
    const afterStock = beforeStock + quantity;

    await variant.update({ stockQty: afterStock }, { transaction });
    await createLedgerEntry({
      type: 'RETURN',
      qty: quantity,
      productId,
      variantId,
      orderId,
      orderItemId,
      beforeStock,
      afterStock,
      beforeReserved,
      afterReserved: beforeReserved,
      createdBy,
      metadata,
      transaction,
    });

    if (syncParent) await syncParentProductFromVariants(productId, transaction);

    return {
      productId,
      variantId,
      stockDelta: quantity,
      reservedDelta: 0,
      beforeStock,
      afterStock,
      beforeReserved,
      afterReserved: beforeReserved,
    };
  }

  const product = await Product.findByPk(productId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  const beforeStock = Number(product.quantity || 0);
  const beforeReserved = Number(product.reservedQty || 0);
  const afterStock = beforeStock + quantity;
  await product.update({ quantity: afterStock }, { transaction });

  await createLedgerEntry({
    type: 'RETURN',
    qty: quantity,
    productId,
    variantId: null,
    orderId,
    orderItemId,
    beforeStock,
    afterStock,
    beforeReserved,
    afterReserved: beforeReserved,
    createdBy,
    metadata,
    transaction,
  });

  return {
    productId,
    variantId: null,
    stockDelta: quantity,
    reservedDelta: 0,
    beforeStock,
    afterStock,
    beforeReserved,
    afterReserved: beforeReserved,
  };
};

module.exports = {
  reserve,
  release,
  shipDeduct,
  restockReturn,
  syncParentProductFromVariants,
};

