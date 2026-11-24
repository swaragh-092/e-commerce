import { useEffect, useState } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';
import { getMetadata } from '../../services/seoService';

export default function SchemaOverrideField({ kind, value, onChange, error, path, name, description, variants = [] }) {
  const [preview, setPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!path) return undefined;
    const request = new AbortController();
    getMetadata(path, { includeGeneratedSchema: true, signal: request.signal }).then((metadata) => {
      if (!request.signal.aborted) setPreview({ path, schema: metadata?.generatedSchema });
    });
    return () => request.abort();
  }, [path]);

  const activeVariants = kind === 'product' ? variants.filter((variant) => variant.isActive !== false) : [];
  const type = kind === 'category' ? 'CollectionPage' : activeVariants.length ? 'ProductGroup' : 'Product';
  const generated = preview?.path === path ? preview?.schema : null;
  const loading = Boolean(path && preview?.path !== path);
  const schema = generated || {
    '@context': 'https://schema.org',
    '@type': type,
    name: name.trim(),
    ...(description && { description }),
    ...(activeVariants.length > 0 && {
      hasVariant: activeVariants.map(({ sku }) => ({ '@type': 'Product', name: name.trim(), ...(sku && { sku }) })),
    }),
  };
  const automatic = JSON.stringify(schema, null, 2);
  const custom = editing || Boolean(value.trim());

  return <Box>
    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
      {custom
        ? <Button size="small" onClick={() => { setEditing(false); onChange(''); }}>Restore automatic schema</Button>
        : <Button size="small" disabled={loading || !schema.name} onClick={() => { setEditing(true); onChange(automatic); }}>
            Edit generated schema
          </Button>}
    </Stack>
    <TextField
      label={custom ? 'Custom JSON-LD schema' : 'Automatic JSON-LD schema'}
      fullWidth
      multiline
      minRows={4}
      maxRows={12}
      value={custom ? value : automatic}
      onChange={(event) => onChange(event.target.value)}
      error={Boolean(error)}
      helperText={error || (custom
        ? 'Save your changes to use this custom schema.'
        : loading ? 'Loading the saved schema…'
          : generated ? 'Generated automatically. Choose Edit generated schema to make a custom copy.'
            : 'Preview based on the editor fields. Published pages may include additional details.')}
      InputProps={{ readOnly: !custom }}
      inputProps={{ maxLength: 12000, spellCheck: false, style: { fontFamily: 'monospace' } }}
    />
  </Box>;
}
