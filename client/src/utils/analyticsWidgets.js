const widget = (id, label, columns = []) => ({ id, label, fields: columns.map((label, index) => [String(index), label]) });

export const CATALOG_ANALYTICS_WIDGETS = [
  widget('visits', 'Page views'), widget('sessions', 'Sessions'), widget('productViews', 'Product views'),
  widget('trend', 'Visits over time'), widget('topViews', 'Most viewed products', ['Product', 'Views']),
  widget('trafficSources', 'Traffic sources', ['Source', 'Visits']),
  widget('campaigns', 'Campaign visits', ['Source', 'Medium', 'Campaign', 'Visits']),
];

export const SALES_ANALYTICS_WIDGETS = [
  widget('conversionRate', 'Conversion summary'),
  widget('productFunnel', 'Product funnel', ['Product', 'Views', 'Add to cart', 'Purchased', 'View to cart', 'Cart to purchase']),
  widget('topProducts', 'Top selling products', ['Rank', 'Product', 'Revenue']),
  widget('aovTrend', 'Average order value'),
  widget('utmAttribution', 'Marketing attribution', ['Source', 'Medium', 'Campaign', 'Orders', 'Revenue']),
  widget('couponPerformance', 'Coupon performance', ['Code', 'Used', 'Revenue', 'Discount given', 'Average discount']),
  widget('paymentMethods', 'Revenue by payment'), widget('abandonedCarts', 'Cart abandonment'),
  widget('repeatCustomers', 'Customer retention'), widget('revenueByCategory', 'Revenue by category'),
  widget('trafficSources', 'Traffic sources'),
  widget('geographicSales', 'Geographic sales', ['State', 'City', 'Orders', 'Revenue']),
  widget('clv', 'Customer lifetime value', ['Customer', 'Orders', 'Lifetime value']),
  widget('refundRate', 'Refund trend'), widget('cohortRetention', 'Cohort retention'),
  widget('rfmSegmentation', 'Customer segmentation', ['Segment', 'Customers', 'Average recency', 'Average frequency', 'Average monetary value']),
  widget('orderHeatmap', 'Order activity'), widget('revenueForecast', 'Revenue forecast'),
];
