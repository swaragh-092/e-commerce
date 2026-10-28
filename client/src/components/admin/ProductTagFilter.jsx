import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { getTags } from '../../services/tagService';

export default function ProductTagFilter({ value, onChange }) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await getTags({ search: input.trim().slice(0, 100), limit: 20 });
        if (!Array.isArray(response?.data)) throw new Error('Invalid tag response');
        const next = response.data;
        if (active) {
          setOptions((current) => {
            const selected = current.find((tag) => tag.slug === value);
            return selected && !next.some((tag) => tag.slug === selected.slug) ? [selected, ...next] : next;
          });
          setError(false);
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [input, value]);
  const fallback = useMemo(() => value ? { slug: value, name: value } : null, [value]);
  const selected = options.find((tag) => tag.slug === value) || fallback;
  return <Autocomplete
    sx={{ minWidth: 220 }} size="small" options={options} value={selected}
    loading={loading} getOptionLabel={(tag) => tag.name}
    isOptionEqualToValue={(option, current) => option.slug === current.slug}
    onInputChange={(_, next, reason) => { if (reason === 'input' || reason === 'clear') setInput(next); }}
    onChange={(_, tag) => { setInput(''); onChange(tag?.slug || ''); }}
    noOptionsText={error ? 'Could not load tags. Type to retry.' : 'No matching tags'}
    renderInput={(params) => <TextField {...params} label="Tag" placeholder="Search tags" />}
  />;
}
