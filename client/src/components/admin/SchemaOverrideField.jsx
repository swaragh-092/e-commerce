import { useEffect, useRef, useState } from 'react';
import { Box, Button, Stack, TextField } from '@mui/material';
import { getMetadata } from '../../services/seoService';

export default function SchemaOverrideField({ kind, value, onChange, error, path, name, description }) {
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const pending = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);
  const type = kind === 'product' ? 'Product' : 'CollectionPage';
  const editSchema = async () => {
    setPreviewError('');
    if (!path) {
      onChange(JSON.stringify({ '@context': 'https://schema.org', '@type': type, name, description }, null, 2));
      return;
    }
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    try {
      const metadata = await getMetadata(path, { includeGeneratedSchema: true, signal: request.signal });
      if (request.signal.aborted) return;
      if (!metadata?.generatedSchema) {
        setPreviewError('Could not load the generated schema. Try again or enter custom JSON-LD below.');
        return;
      }
      onChange(JSON.stringify(metadata.generatedSchema, null, 2));
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return <Box>
    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
      {value.trim()
        ? <Button size="small" onClick={() => { setPreviewError(''); onChange(''); }}>Restore automatic schema</Button>
        : <Button size="small" onClick={editSchema} disabled={loading || (!path && !name.trim())}>
          {loading ? 'Loading schema…' : path ? 'Edit generated schema' : 'Start custom schema'}
        </Button>}
    </Stack>
    <TextField
      label="Custom JSON-LD schema"
      fullWidth
      multiline
      minRows={4}
      maxRows={12}
      value={value}
      onChange={(event) => {
        setPreviewError('');
        onChange(event.target.value);
      }}
      disabled={loading}
      error={Boolean(error || previewError)}
      helperText={error || previewError || `Enter one ${kind === 'product' ? 'Product or ProductGroup' : 'CollectionPage'} JSON object. Leave blank to use the automatic schema.`}
      inputProps={{ maxLength: 12000, spellCheck: false, style: { fontFamily: 'monospace' } }}
    />
  </Box>;
}
