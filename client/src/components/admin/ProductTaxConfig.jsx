import React from 'react';
import {
  Box, Typography, TextField, Paper, Grid,
  Checkbox, FormControlLabel, Divider, Alert,
} from '@mui/material';

/* ─── Tax Configuration Section ────────────────────────────────────────────── */
const TaxConfigSection = ({ taxConfig, basePrice, setTaxConfig, globalSettings, formatPrice, disabled }) => {
  const handleChange = (field, value) => {
    setTaxConfig({ ...taxConfig, [field]: value });
  };

  // Live tax preview logic
  const isGST = globalSettings.enableCGST || globalSettings.enableSGST || globalSettings.enableIGST;
  const currentPrice = parseFloat(basePrice) || 0;
  
  const effective = taxConfig.isCustom ? taxConfig : {
    sgst: parseFloat(globalSettings.sgstRate || 0),
    cgst: parseFloat(globalSettings.cgstRate || 0),
    igst: parseFloat(globalSettings.igstRate || 0),
    inclusive: globalSettings.inclusive,
  };

  const sgstRate = effective.sgst || 0;
  const cgstRate = effective.cgst || 0;
  const igstRate = effective.igst || 0;

  let sgstAmount, cgstAmount, igstAmount, taxTotal, subtotal;
  if (effective.inclusive) {
    const netSubtotal = currentPrice / (1 + sgstRate + cgstRate + igstRate);
    sgstAmount = netSubtotal * sgstRate;
    cgstAmount = netSubtotal * cgstRate;
    igstAmount = netSubtotal * igstRate;
    taxTotal = sgstAmount + cgstAmount + igstAmount;
    subtotal = netSubtotal;
  } else {
    sgstAmount = currentPrice * sgstRate;
    cgstAmount = currentPrice * cgstRate;
    igstAmount = currentPrice * igstRate;
    taxTotal = sgstAmount + cgstAmount + igstAmount;
    subtotal = currentPrice;
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          Tax Configuration
        </Typography>
        <FormControlLabel
          control={
            <Checkbox 
              checked={taxConfig.isCustom} 
              onChange={(e) => handleChange('isCustom', e.target.checked)}
              disabled={disabled}
            />
          }
          label={<Typography variant="body2" fontWeight={500}>Custom Tax</Typography>}
        />
      </Box>

      {!taxConfig.isCustom ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Using global tax settings ({((parseFloat(globalSettings.sgstRate || 0) + parseFloat(globalSettings.cgstRate || 0)) * 100).toFixed(0)}% GST).
        </Alert>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={taxConfig.inclusive} 
                  onChange={(e) => handleChange('inclusive', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Prices include tax"
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="SGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.sgst * 100).toFixed(2)}
              onChange={(e) => handleChange('sgst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="CGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.cgst * 100).toFixed(2)}
              onChange={(e) => handleChange('cgst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="IGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.igst * 100).toFixed(2)}
              onChange={(e) => handleChange('igst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
        </Grid>
      )}

      {currentPrice > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            INTRA-STATE PREVIEW (ESTIMATE)
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">Subtotal:</Typography>
            <Typography variant="body2" fontWeight={500}>{formatPrice(subtotal)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">Tax (Estimated):</Typography>
            <Typography variant="body2" fontWeight={500}>+ {formatPrice(taxTotal)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">Total:</Typography>
            <Typography variant="subtitle2" color="primary.main">{formatPrice(subtotal + taxTotal)}</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
};


export default TaxConfigSection;
