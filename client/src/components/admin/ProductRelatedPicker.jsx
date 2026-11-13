import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { getProducts, getRelatedSelection, saveRelatedSelection } from '../../services/productService';

const rowsOf = (value) => Array.isArray(value) ? value : (value?.data || value?.products || []);

export default function ProductRelatedPicker({ productId, canEdit = false }) {
  const [selected, setSelected] = useState([]);
  const [options, setOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRelatedSelection(productId)
      .then((related) => { if (active) setSelected(rowsOf(related)); })
      .catch(() => { if (active) setError('Could not load related products.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const query = search.trim();
      getProducts({ page: 1, limit: 100, ...(query.length >= 2 ? { search: query } : {}) })
        .then((result) => {
          if (!active) return;
          const available = rowsOf(result).filter((item) => item.id !== productId);
          setOptions([...new Map([...selected, ...available].map((item) => [item.id, item])).values()]);
        })
        .catch(() => { if (active) setError('Could not search products.'); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [productId, search, selected]);

  const selectedIds = useMemo(() => selected.map((item) => item.id), [selected]);
  const save = async () => {
    setSaving(true); setError('');
    try {
      setSelected(rowsOf(await saveRelatedSelection(productId, selectedIds)));
    } catch {
      setError('Could not save related products. Please try again.');
    } finally { setSaving(false); }
  };

  return <Stack spacing={2}>
    <Box><Typography variant="h6">Related products</Typography>
      <Typography variant="body2" color="text.secondary">Choose up to 12 products to recommend on this product page. Type to search the full catalog.</Typography></Box>
    {loading ? <CircularProgress size={24} /> : <>
      <Autocomplete multiple options={options} value={selected}
        inputValue={search} onInputChange={(_, value) => setSearch(value)}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionLabel={(item) => item.name || item.title || item.sku || item.id}
        onChange={(_, value) => setSelected(value.slice(0, 12))}
        disabled={!canEdit || saving}
        filterOptions={(items) => items}
        renderTags={(value, getTagProps) => value.map((option, index) =>
          <Chip label={option.name || option.title || option.sku} {...getTagProps({ index })} key={option.id} />)}
        renderInput={(params) => <TextField {...params} label="Related products" placeholder="Search products" />}
      />
      {error && <Typography color="error" role="alert">{error}</Typography>}
      {canEdit && <Button variant="contained" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save related products'}
      </Button>}
    </>}
  </Stack>;
}
