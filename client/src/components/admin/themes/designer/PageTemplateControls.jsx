import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, MenuItem, Stack, TextField } from '@mui/material';
import { getProducts } from '../../../../services/productService';

import { getCategoryTree } from '../../../../services/categoryService';
import { PAGE_TEMPLATE_ASSIGNMENT_KEYS } from '../../../../utils/designerSections';

const flattenCategories = (categories) => categories.flatMap((category) => [
  category,
  ...flattenCategories(category.children || []),
]);

export default function PageTemplateControls({ page, templates, defaultSettings, selectedTemplate, onSelect, onChange }) {
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [searchError, setSearchError] = useState(false);
  const templateName = name.trim();
  const duplicateName = templates.some((template) => template.name.toLowerCase() === templateName.toLowerCase());
  const isCategory = page === 'category';
  const assignmentKey = PAGE_TEMPLATE_ASSIGNMENT_KEYS[page];
  const assigned = selectedTemplate?.[assignmentKey] || [];
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState(false);
  const showCategories = isCategory && Boolean(selectedTemplate);

  useEffect(() => {
    if (!showCategories) return undefined;
    let active = true;
    setCategoryError(false);
    getCategoryTree({ hideEmpty: false }).then(({ data }) => {
      if (active) setCategories(flattenCategories(data || []).filter(({ slug }) => slug));
    }).catch(() => {
      if (active) setCategoryError(true);
    });
    return () => { active = false; };
  }, [showCategories]);

  useEffect(() => {
    if (isCategory || !selectedTemplate || search.trim().length < 2) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await getProducts({ search: search.trim(), status: 'published', limit: 20 });
        if (active) setMatches((data || []).filter((product) => product.slug && product.isEnabled !== false));
      } catch {
        if (active) setSearchError(true);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isCategory, search, selectedTemplate]);

  const create = () => {
    const id = crypto.randomUUID();
    onChange([...templates, { id, name: templateName, [assignmentKey]: [], settings: structuredClone(defaultSettings) }]);
    setName('');
    onSelect(id);
  };

  const assign = (slug) => {
    onChange(templates.map((template) => ({
      ...template,
      [assignmentKey]: template.id === selectedTemplate.id
        ? [...assigned, slug]
        : template[assignmentKey].filter((item) => item !== slug),
    })));
  };

  return (
    <Stack spacing={1} sx={{ px: 1, pb: 1 }}>
      <TextField select size="small" label={isCategory ? 'Category template' : 'Product template'} value={selectedTemplate?.id || ''}
        InputLabelProps={{ shrink: true }} SelectProps={{ displayEmpty: true }}
        onChange={(event) => onSelect(event.target.value)}>
        <MenuItem value="">{isCategory ? 'Default category' : 'Default product'}</MenuItem>
        {templates.map(({ id, name: label }) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
      </TextField>
      <TextField size="small" label="New template name" value={name}
        onChange={(event) => setName(event.target.value)} inputProps={{ maxLength: 60 }}
        error={duplicateName} helperText={duplicateName ? 'Choose a unique name.' : undefined} />
      <Button size="small" disabled={!templateName || duplicateName} onClick={create}>Duplicate default template</Button>
      {selectedTemplate && (
        <>
          <Autocomplete
            size="small" value={null} inputValue={search}
            options={(isCategory ? categories : matches).filter(({ slug }) => !assigned.includes(slug))}
            getOptionLabel={(product) => product.name || product.slug}
            getOptionKey={(product) => product.slug}
            filterOptions={isCategory ? undefined : (options) => options}
            onInputChange={(_, value, reason) => {
              if (reason !== 'input' && reason !== 'clear') return;
              setSearch(value);
              setMatches([]);
              setSearchError(false);
            }}
            onChange={(_, record) => {
              if (!record) return;
              assign(record.slug);
              setSearch('');
              setMatches([]);
            }}
            renderInput={(params) => <TextField {...params} label={isCategory ? 'Assign a category' : 'Assign a product'} />}
          />
          {isCategory && categoryError && <Alert severity="error">Could not load categories.</Alert>}
          {!isCategory && searchError && <Alert severity="error">Could not search products. Try again.</Alert>}
          {assigned.length > 0 && <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {assigned.map((slug) => (
              <Box component="li" key={slug}>
                <Chip label={slug} onDelete={() => onChange(templates.map((template) =>
                  template.id === selectedTemplate.id
                    ? { ...template, [assignmentKey]: assigned.filter((item) => item !== slug) }
                    : template))} />
              </Box>
            ))}
          </Stack>}
        </>
      )}
    </Stack>
  );
}
