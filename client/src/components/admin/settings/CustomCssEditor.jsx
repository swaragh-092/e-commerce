import { Box, Typography, TextField, Alert } from '@mui/material';
import CssVarsPanel from './CssVarsPanel';

const CustomCssEditor = ({ value = {}, onChange, disabled = false }) => {
  const customCSS = value.customCSS || '';

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        Advanced Custom CSS
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add theme-aware CSS overrides without leaving Store Designer. This is for trusted admins only and is never included in imported theme packages.
      </Typography>
      {disabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          You need the advanced settings permission to edit custom CSS.
        </Alert>
      )}
      <TextField
        fullWidth
        multiline
        minRows={12}
        size="small"
        label="Custom CSS"
        placeholder={`.product-card {\n  box-shadow: var(--store-shadow-card);\n}\n\n.storefront-hero {\n  border-radius: var(--store-radius-card);\n}`}
        value={customCSS}
        onChange={(e) => onChange({ ...value, customCSS: e.target.value })}
        disabled={disabled}
        sx={{ mb: 2, fontFamily: 'monospace' }}
        InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
        helperText="Applied after theme styles. Use --store-* variables so CSS stays compatible with theme changes."
      />
      <CssVarsPanel />
    </Box>
  );
};

export default CustomCssEditor;
