export const option = (attributeId, valueId, name = attributeId, label = valueId) => ({
  attributeId, valueId, attribute: { id: attributeId, name }, value: { id: valueId, value: label },
});
export const product = {
  id: 'product-1', name: 'Marigold', slug: 'marigold', type: 'variable', categories: [{ slug: 'flowers' }],
  images: [{ url: '/parent.jpg', isPrimary: true }],
  variants: [
    { id: 'v1', sku: 'RED-50', options: [option('colour', 'red'), option('days', '50')], images: [{ url: '/red.jpg' }] },
    { id: 'v2', sku: 'BLUE-50', options: [option('colour', 'blue'), option('days', '50')] },
    { id: 'v3', sku: 'RED-60', options: [option('colour', 'red'), option('days', '60')] },
    { id: 'inactive', isActive: false, options: [option('colour', 'blue'), option('days', '60')] },
  ],
};
