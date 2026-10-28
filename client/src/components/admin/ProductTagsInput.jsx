import { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { getTags } from '../../services/tagService';

const normalize = (name) => name.normalize('NFKC').trim().replace(/\s+/gu, ' ');

export default function ProductTagsInput({ value = [], onChange, disabled = false, error, allowCreate = true, helperText }) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getTags({ search: input.trim().slice(0, 100), limit: 20 });
        if (active) { setOptions((res.data || []).map((tag) => tag.name)); setLoadError(false); }
      } catch {
        if (active) setLoadError(true);
      } finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [input]);

  return (
    <Autocomplete
      multiple freeSolo={allowCreate} autoSelect clearOnBlur disabled={disabled}
      options={options} value={value} inputValue={input} loading={loading}
      onInputChange={(_, next) => setInput(next)}
      onChange={(_, names) => {
        const unique = new Map();
        names.forEach((name) => {
          const clean = normalize(name);
          if (clean && !unique.has(clean.toLowerCase())) unique.set(clean.toLowerCase(), clean);
        });
        onChange([...unique.values()]);
      }}
      renderInput={(params) => (
        <TextField {...params} label="Tags" error={Boolean(error)} margin="normal"
          helperText={error || (loadError ? (allowCreate ? 'Suggestions could not load. You can still type tags and press Enter.' : 'Suggestions could not load. Type to retry.') : (helperText || 'Choose existing tags or type a new label and press Enter. Up to 50 tags, 100 characters each.'))}
        />
      )}
    />
  );
}
