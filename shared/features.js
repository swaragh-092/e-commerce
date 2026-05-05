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
