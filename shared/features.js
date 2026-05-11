'use strict';

/**
 * Shared Feature and Status Constants
 * ──────────────────────────────────
 * This file defines the core functionality toggles and 
 * status values used across the application.
 */

const ECOMMERCE_FUNCTIONALITY = process.env.ECOMMERCE_FUNCTIONALITY === 'true';

const FEATURES = {
    customers: ECOMMERCE_FUNCTIONALITY,
    product: {
        pricing: ECOMMERCE_FUNCTIONALITY,
        reviews: ECOMMERCE_FUNCTIONALITY,
        inventory: ECOMMERCE_FUNCTIONALITY,
    },
    // Structural features
    category: true,
    brand: true,
    pages: true,
    settings: true,
    seo: ECOMMERCE_FUNCTIONALITY,
    
    // Ecommerce specific (only active if ECOMMERCE_FUNCTIONALITY is true)
    tax: ECOMMERCE_FUNCTIONALITY,
    shipping: ECOMMERCE_FUNCTIONALITY,
    orders: ECOMMERCE_FUNCTIONALITY,
    payments: ECOMMERCE_FUNCTIONALITY,
    coupons: ECOMMERCE_FUNCTIONALITY,
    sales: ECOMMERCE_FUNCTIONALITY,
    reviews: ECOMMERCE_FUNCTIONALITY,
    messaging: ECOMMERCE_FUNCTIONALITY,
    cart: ECOMMERCE_FUNCTIONALITY,
    wishlist: ECOMMERCE_FUNCTIONALITY,
    
    // Inverse features
    enquiry: !ECOMMERCE_FUNCTIONALITY,
};

const PAYMENT_STATUS = [
    "payment_pending",
    "pending_cod",
    "payment_failed",
    "payment_expired",
    "paid_cod",
    "paid_online"
];

const ORDER_STATUS = [
    "confirmed",
    "on_hold",
    "processing",
    "ready_for_shipment",
    "cancelled",
    "closed"
];

const SHIPPING_STATUS = [
    "not_shipped",
    "partially_shipped",
    "shipped",
    "partially_out_for_delivery",
    "out_for_delivery",
    "partially_delivered",
    "delivered",
    "delivery_failed",
    "partially_rto",
    "rto_initiated",
    "rto"
];

const PUT_BACK_STATUS = [
    "full_return",
    "full_replacement",
    "partial_return",
    "partial_replacement",
];

const REFUND_STATUS = [
    "refund_initiated",
    "refund_processing",
    "refund_failed",
    "refunded",
    "partially_refunded"
];

const RETURN_STATUS = [
    "return_requested",
    "return_approved",
    "return_rejected",
    "pickup_scheduled",
    "pickup_completed",
    "returned",
    "return_completed",
    "replacement_requested",
    "replacement_approved",
    "replacement_rejected",
    "replacement_processing",
    "replacement_shipped",
    "replacement_delivered",
    "replacement_completed"
];

module.exports = {
    FEATURES,
    PAYMENT_STATUS,
    ORDER_STATUS,
    SHIPPING_STATUS,
    PUT_BACK_STATUS,
    REFUND_STATUS,
    RETURN_STATUS
};