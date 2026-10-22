import React, { useState } from 'react';
import {
  Alert, Box, Checkbox, Divider, FormControlLabel, Grid, TextField, Typography,
} from '@mui/material';

const isEnabled = (value) => value === true || value === 'true';
const normalizeRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Math.abs(rate) > 1 ? rate / 100 : rate;
};
const formatRate = (rate) => `${Number((rate * 100).toFixed(2))}%`;

const TaxConfigSection = ({
  taxConfig, basePrice, priceLabel, setTaxConfig, globalSettings, formatPrice, disabled, error,
}) => {
  const [editingRate, setEditingRate] = useState(null);
  const [rateInput, setRateInput] = useState('');
  const handleChange = (field, value) => setTaxConfig({ ...taxConfig, [field]: value });
  const globalGST = ['enableCGST', 'enableSGST', 'enableIGST'].some((key) => isEnabled(globalSettings[key]));
  const effective = taxConfig.isCustom ? {
    sgst: normalizeRate(taxConfig.sgst),
    cgst: normalizeRate(taxConfig.cgst),
    igst: normalizeRate(taxConfig.igst),
    flatRate: normalizeRate(taxConfig.flatRate || taxConfig.rate),
    inclusive: isEnabled(taxConfig.inclusive),
    useGST: Boolean(taxConfig.sgst || taxConfig.cgst || taxConfig.igst),
  } : {
    sgst: isEnabled(globalSettings.enableSGST) ? normalizeRate(globalSettings.sgstRate) : 0,
    cgst: isEnabled(globalSettings.enableCGST) ? normalizeRate(globalSettings.cgstRate) : 0,
    igst: isEnabled(globalSettings.enableIGST) ? normalizeRate(globalSettings.igstRate) : 0,
    flatRate: globalGST ? 0 : normalizeRate(globalSettings.rate),
    inclusive: !globalGST && isEnabled(globalSettings.inclusive),
    useGST: globalGST,
  };

  const sameStateRate = effective.useGST ? effective.sgst + effective.cgst : effective.flatRate;
  const otherStateRate = effective.useGST ? effective.igst : effective.flatRate;
  const currentPrice = Number(basePrice);
  const hasPrice = Number.isFinite(currentPrice) && currentPrice > 0;
  const subtotal = effective.inclusive ? currentPrice / (1 + sameStateRate) : currentPrice;
  const taxTotal = effective.inclusive ? currentPrice - subtotal : currentPrice * sameStateRate;
  const total = effective.inclusive ? currentPrice : subtotal + taxTotal;

  const globalSameStateRate =
    (isEnabled(globalSettings.enableSGST) ? normalizeRate(globalSettings.sgstRate) : 0)
    + (isEnabled(globalSettings.enableCGST) ? normalizeRate(globalSettings.cgstRate) : 0);
  const globalOtherStateRate = isEnabled(globalSettings.enableIGST) ? normalizeRate(globalSettings.igstRate) : 0;
  const globalSummary = globalGST
    ? `Store settings: ${formatRate(globalSameStateRate)} SGST + CGST for buyers in your state; ${formatRate(globalOtherStateRate)} IGST for buyers in another state.`
    : normalizeRate(globalSettings.rate) > 0
      ? `Store tax: ${formatRate(normalizeRate(globalSettings.rate))} ${isEnabled(globalSettings.inclusive) ? 'included in the price' : 'added at checkout'}.`
      : 'Store tax settings currently add no tax.';

  return (
    <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Tax for this product</Typography>
          <Typography variant="body2" color="text.secondary">
            Use store tax settings or override the rates for this product.
          </Typography>
        </Box>
        <FormControlLabel
          control={(
            <Checkbox
              checked={Boolean(taxConfig.isCustom)}
              onChange={(event) => handleChange('isCustom', event.target.checked)}
              disabled={disabled}
            />
          )}
          label="Use custom tax rates"
        />
      </Box>

      <Grid container spacing={3} alignItems="stretch">
        <Grid item xs={12} lg={7}>
          {!taxConfig.isCustom ? (
            <Alert severity="info">{globalSummary}</Alert>
          ) : (
            <>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={Boolean(taxConfig.inclusive)}
                    onChange={(event) => handleChange('inclusive', event.target.checked)}
                    disabled={disabled}
                  />
                )}
                label="Prices include tax"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Buyers in your state use SGST + CGST. Buyers in another state use IGST.
              </Typography>
              <Grid container spacing={2}>
                {[
                  ['sgst', 'SGST (%)'],
                  ['cgst', 'CGST (%)'],
                  ['igst', 'IGST (%)'],
                ].map(([field, label]) => (
                  <Grid item xs={12} sm={4} key={field}>
                    <TextField
                      label={label}
                      type="number"
                      fullWidth
                      size="small"
                      inputProps={{ min: 0, max: 100, step: '0.01' }}
                      value={editingRate === field ? rateInput : Number((normalizeRate(taxConfig[field]) * 100).toFixed(2))}
                      onFocus={(event) => {
                        setEditingRate(field);
                        setRateInput(event.target.value);
                      }}
                      onBlur={() => setEditingRate(null)}
                      onChange={(event) => {
                        setRateInput(event.target.value);
                        handleChange(field, event.target.value === '' ? 0 : Number(event.target.value) / 100);
                      }}
                      disabled={disabled}
                    />
                  </Grid>
                ))}
              </Grid>
            </>
          )}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </Grid>

        <Grid item xs={12} lg={5}>
          <Box sx={{ p: 2, height: '100%', bgcolor: 'action.hover', borderRadius: 1, fontVariantNumeric: 'tabular-nums' }}>
            <Typography variant="subtitle2" gutterBottom>Price and tax estimate</Typography>
            {!hasPrice ? (
              <Typography variant="body2" color="text.secondary">Enter an MRP to see the estimate.</Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  One item, buyer in your state, based on {priceLabel.toLowerCase()}.
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                  <Typography variant="body2">{effective.inclusive ? 'Price before tax' : 'Item price'}</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatPrice(subtotal)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                  <Typography variant="body2">{effective.inclusive ? 'Tax included' : 'Estimated tax'}</Typography>
                  <Typography variant="body2" fontWeight={600}>{effective.inclusive ? '' : '+ '}{formatPrice(taxTotal)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="subtitle2">Estimated total</Typography>
                  <Typography variant="subtitle2" color="primary.main">{formatPrice(total)}</Typography>
                </Box>
                {effective.useGST && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                    Buyer in another state: {formatRate(otherStateRate)} IGST.
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Final checkout tax depends on the buyer location; shipping is excluded.
                </Typography>
              </>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TaxConfigSection;
