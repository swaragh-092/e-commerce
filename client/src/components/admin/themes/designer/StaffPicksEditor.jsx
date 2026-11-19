import { useEffect, useState } from 'react';
import { Autocomplete, Button, Stack, TextField, Typography } from '@mui/material';
import { getProducts } from '../../../../services/productService';
import { fetchStaffPicks } from '../../../../utils/productRowSources';

const MAX_PICKS = 12;

export default function StaffPicksEditor({ ids, onChange }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [names, setNames] = useState({});
  const [searchFailed, setSearchFailed] = useState(false);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!idsKey) return undefined;
    let active = true;
    fetchStaffPicks({ productIds: idsKey.split(',') }, getProducts)
      .then(({ data }) => {
        if (active) setNames((current) => ({
          ...current,
          ...Object.fromEntries(data.map(({ id, name }) => [id, name])),
        }));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [idsKey]);

  useEffect(() => {
    if (search.trim().length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await getProducts({ search: search.trim(), status: 'published', limit: 20 });
        if (active) setOptions((response.data || []).filter((product) => product.isEnabled !== false));
      } catch {
        if (active) setSearchFailed(true);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const move = (index, direction) => {
    const reordered = [...ids];
    const other = index + direction;
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
    onChange(reordered);
  };

  return (
    <Stack spacing={1}>
      <Autocomplete
        size="small"
        disabled={ids.length >= MAX_PICKS}
        value={null}
        inputValue={search}
        options={options.filter((product) => !ids.includes(product.id))}
        filterOptions={(results) => results}
        getOptionLabel={(product) => product.name}
        onInputChange={(_, value) => {
          setSearch(value);
          setOptions([]);
          setSearchFailed(false);
        }}
        onChange={(_, product) => {
          if (!product || ids.length >= MAX_PICKS) return;
          setNames((current) => ({ ...current, [product.id]: product.name }));
          onChange([...ids, product.id]);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Add a product"
            error={searchFailed}
            helperText={searchFailed ? 'Could not search products. Try again.' : `${ids.length} of ${MAX_PICKS} selected`}
          />
        )}
      />
      {ids.map((id, index) => {
        const name = names[id] || `Product ${index + 1}`;
        return (
          <Stack key={id} direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" sx={{ flexGrow: 1 }}>{name}</Typography>
            <Button size="small" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(index, -1)}>Up</Button>
            <Button size="small" aria-label={`Move ${name} down`} disabled={index === ids.length - 1} onClick={() => move(index, 1)}>Down</Button>
            <Button size="small" aria-label={`Remove ${name}`} onClick={() => onChange(ids.filter((pick) => pick !== id))}>Remove</Button>
          </Stack>
        );
      })}
    </Stack>
  );
}
