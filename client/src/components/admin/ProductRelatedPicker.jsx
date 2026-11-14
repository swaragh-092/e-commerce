import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Box, Button, CircularProgress, Divider, IconButton, Stack, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getProducts, getRelatedSelection, saveRelatedSelection } from '../../services/productService';

const rowsOf = (value) => Array.isArray(value) ? value : (value?.data || value?.products || []);

export default function ProductRelatedPicker({ productId, canEdit = false }) {
  const [selected, setSelected] = useState([]);
  const [savedIds, setSavedIds] = useState(null);
  const [options, setOptions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRelatedSelection(productId)
      .then((related) => { if (!active) return;
        const rows = rowsOf(related);
        setSelected(rows);
        setSavedIds(rows.map((item) => item.id)); })
      .catch(() => { if (active) setError('Could not load related products.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    if (!canEdit) return;
    let active = true;
    const timer = setTimeout(() => {
      const query = search.trim();
      getProducts({ page: 1, limit: 100, ...(query.length >= 2 ? { search: query } : {}) })
        .then((result) => {
          if (!active) return;
          const available = rowsOf(result).filter((item) => item.id !== productId);
          setOptions(available);
        })
        .catch(() => { if (active) setError('Could not search products.'); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [canEdit, productId, search]);

  const selectedIds = useMemo(() => selected.map((item) => item.id), [selected]);
  const changed = savedIds !== null && (savedIds.length !== selectedIds.length || savedIds.some((id, index) => id !== selectedIds[index]));
  const save = async () => {
    setSaving(true); setError('');
    try {
      const rows = rowsOf(await saveRelatedSelection(productId, selectedIds));
      setSelected(rows);
      setSavedIds(rows.map((item) => item.id));
    } catch {
      setError('Could not save related products. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Box>
          <Typography variant="h6">Related products</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose up to 12 products to recommend on this product page.
          </Typography>
        </Box>
        {canEdit && (
          <Button variant="outlined" size="small" onClick={save} disabled={saving || !changed}>
            {saving ? 'Saving…' : 'Save related products'}
          </Button>
        )}
      </Stack>
      <Divider />
      {error && <Typography color="error" role="alert">{error}</Typography>}
      {loading && <CircularProgress size={24} aria-label="Loading related products" />}
      {savedIds !== null && (
        <>
          {canEdit && (
            <Autocomplete
              size="small"
              sx={{ width: '100%', maxWidth: 480 }}
              options={options.filter((item) => !selectedIds.includes(item.id))}
              value={null}
              inputValue={search}
              onInputChange={(_, value) => setSearch(value)}
              onChange={(_, item) => {
                if (item) setSelected((current) => [...current, item]);
                setSearch('');
              }}
              disabled={saving || selected.length >= 12}
              getOptionKey={(item) => item.id}
              getOptionLabel={(item) => item.name || item.title || item.sku || item.id}
              filterOptions={(items) => items}
              noOptionsText="No matching products"
              renderOption={(props, item) => {
                const { key, ...optionProps } = props;
                return (
                  <li key={key} {...optionProps}>
                    <Box>
                      <Typography variant="body2">{item.name || item.title || item.id}</Typography>
                      {item.sku && <Typography variant="caption" color="text.secondary">{item.sku}</Typography>}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => <TextField {...params} label="Add a product" placeholder="Search products" />}
            />
          )}
          <Typography variant="body2" color="text.secondary" role="status">
            {selected.length ? `${selected.length} of 12 selected` : 'No products selected'}
          </Typography>
          {selected.length > 0 && (
            <Stack component="ul" divider={<Divider component="li" />} sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              {selected.map((item) => {
                const name = item.name || item.title || item.sku || item.id;
                return (
                  <Stack component="li" key={item.id} direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ px: 1.5, py: 0.75 }}>
                    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      <Typography variant="body2" fontWeight={600}>{name}</Typography>
                      {item.sku && <Typography variant="caption" color="text.secondary">{item.sku}</Typography>}
                    </Box>
                    {canEdit && (
                      <IconButton size="small" aria-label={`Remove ${name}`} disabled={saving}
                        onClick={() => setSelected((current) => current.filter(({ id }) => id !== item.id))}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
