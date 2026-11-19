import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
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
  const [dialog, setDialog] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const templateName = name.trim();
  const isCategory = page === 'category';
  const defaultLabel = isCategory ? 'Default category' : 'Default product';
  const nameInUse = (value, exceptId) => {
    const normalized = value.toLowerCase();
    return normalized === defaultLabel.toLowerCase()
      || templates.some((template) => template.id !== exceptId && template.name.toLowerCase() === normalized);
  };
  const duplicateName = nameInUse(templateName);
  const renameDuplicate = nameInUse(renameValue.trim(), selectedTemplate?.id);
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
        <MenuItem value="">{defaultLabel}</MenuItem>
        {templates.map(({ id, name: label }) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
      </TextField>
      <TextField size="small" label="New template name" value={name}
        onChange={(event) => setName(event.target.value)} inputProps={{ maxLength: 60 }}
        error={duplicateName} helperText={duplicateName ? 'Choose a unique name.' : undefined} />
      <Button size="small" disabled={!templateName || duplicateName} onClick={create}>Duplicate default template</Button>
      {selectedTemplate && (
        <>
          <Typography variant="body2" color="text.secondary">
            {assigned.length} {isCategory
              ? (assigned.length === 1 ? 'category' : 'categories')
              : (assigned.length === 1 ? 'product' : 'products')} assigned
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => {
              setRenameValue(selectedTemplate.name);
              setDialog('rename');
            }}>Rename template</Button>
            <Button size="small" color="error" onClick={() => setDialog('remove')}>Remove template</Button>
          </Stack>
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
      {selectedTemplate && <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="xs">
        <DialogTitle>{dialog === 'remove' ? 'Remove template?' : 'Rename template'}</DialogTitle>
        <DialogContent>
          {dialog === 'remove' ? (
            <Typography>
              Remove {selectedTemplate.name} from the draft? After publishing, all {assigned.length} assigned pages will use the default template.
            </Typography>
          ) : (
            <TextField autoFocus fullWidth margin="dense" label="Template name" value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)} inputProps={{ maxLength: 60 }}
              error={renameDuplicate} helperText={renameDuplicate ? 'Choose a unique name.' : undefined} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          {dialog === 'remove' ? (
            <Button color="error" onClick={() => {
              onChange(templates.filter(({ id }) => id !== selectedTemplate.id));
              setDialog(null);
              onSelect('');
            }}>Remove from draft</Button>
          ) : (
            <Button disabled={!renameValue.trim() || renameDuplicate} onClick={() => {
              onChange(templates.map((template) => template.id === selectedTemplate.id
                ? { ...template, name: renameValue.trim() } : template));
              setDialog(null);
            }}>Save name</Button>
          )}
        </DialogActions>
      </Dialog>}
    </Stack>
  );
}
