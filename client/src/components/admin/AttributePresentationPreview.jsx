import React from 'react';
import { Box, Typography } from '@mui/material';
import VariantSelector from '../product/VariantSelector';
import { inferValueType, resolveAttributePresentation } from '../../utils/attributePresentation';

const samples = {
  color: ['Red', 'Blue'], size: ['S', 'M'], weight: ['250g', '500g'],
  length: ['10cm', '20cm'], storage: ['128GB', '256GB'], volume: ['250ml', '500ml'],
  material: ['Cotton', 'Wool'], pattern: ['Striped', 'Floral'], number: ['1', '2'],
};
const ignoreSelection = () => {};

export default function AttributePresentationPreview({ attribute, values = [] }) {
  const type = inferValueType(attribute);
  const previewValues = values.length ? values : (samples[type] || ['Option A', 'Option B']).map((value, index) => ({ id: `sample-${index}`, value }));
  const previewAttribute = { ...attribute, id: 'preview', name: attribute.name || 'Attribute' };
  const presentation = resolveAttributePresentation({ attribute: previewAttribute, values: previewValues });
  const variants = previewValues.map((value) => ({
    id: value.id, stockQty: 1, isActive: true,
    options: [{ attribute: previewAttribute, value }],
  }));

  return <Box sx={{ mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <Typography variant="subtitle2">Storefront preview</Typography>
    <Typography variant="body2" color="text.secondary">
      Value type: {type}. Display style: {presentation.displayType}.
    </Typography>
    <VariantSelector key={JSON.stringify([previewAttribute, previewValues])} variants={variants} onSelect={ignoreSelection} />
    <Typography variant="caption" color="text.secondary" display="block">
      {values.length ? 'Using saved values. Products show only their assigned variant values.' : 'Example values only; these will not be saved.'} Click an option to try it.
    </Typography>
    <Typography variant="caption" color="text.secondary" display="block">
      This style applies to product variant choices. Specifications stay as text. Image swatches need image URLs; missing visuals show labels.
    </Typography>
  </Box>;
}
