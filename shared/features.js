const { settings } = require('cluster');

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });


const ECOMMERCE_FUNCTIONALITY = process.env.ECOMMERCE_FUNCTIONALITY === 'true';


const FEATURES = {
    customers : ECOMMERCE_FUNCTIONALITY,
    product : {
        pricing : ECOMMERCE_FUNCTIONALITY,
        reviews : ECOMMERCE_FUNCTIONALITY,
        inventory : ECOMMERCE_FUNCTIONALITY,
    },
    tax : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing,
    shipping : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing,
    category : true ,
    brand : true,
    orders : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing,
    payments : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing && this.orders,
    coupons : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing && this.orders,
    sales : ECOMMERCE_FUNCTIONALITY && this.customers && this.product.pricing && this.orders,
    reviews : true && this.customers && this.product.pricing && this.product.orders,
    seo : ECOMMERCE_FUNCTIONALITY,
    messaging : ECOMMERCE_FUNCTIONALITY && this.customers && this.orders,
    pages : true,
    settings : true,
    enquiry : !ECOMMERCE_FUNCTIONALITY,
    cart : ECOMMERCE_FUNCTIONALITY && this.customers && this.orders,
    wishlist : ECOMMERCE_FUNCTIONALITY ,
}





/*


payment_pending
pending_cod
payment_failed
payment_expired
paid

confirmed
on_hold
processing
packed
ready_to_ship

partially_shipped
shipped
out_for_delivery
delivery_attempted
delivered

cancelled

rto_initiated
rto

return_requested
return_approved
return_rejected
pickup_scheduled
pickup_completed
returned

refund_initiated
refund_processing
refund_failed
refunded

replacement_requested
replacement_approved
replacement_rejected
replacement_processing
replacement_shipped
replacement_delivered

partially_return_requested
partially_return_approved
partially_return_rejected
partially_pickup_scheduled
partially_pickup_completed
partially_returned

partially_refund_initiated
partially_refund_processing
partially_refund_failed
partially_refunded

partially_replacement_requested
partially_replacement_processing
partially_replacement_shipped
partially_replacement_delivered


*/

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
  "partially_shipped",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "delivered",
  "rto_initiated",
  "rto"
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

const PUT_BACK_PROCESSING_STATUS = [
    true, false
]

const REFUND_STATUS = [
  "refund_initiated",
  "refund_processing",
  "refund_failed",
  "refunded",
  "partially_refunded"
];






// THIS COMES IN DIFFERENT TABLE. FOR EACH RETURN REQUEST.
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