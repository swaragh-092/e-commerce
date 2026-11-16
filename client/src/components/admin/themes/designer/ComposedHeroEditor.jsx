import useHeroCategories from '../../../../hooks/useHeroCategories';
import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { HERO_BLOCK_LABELS, HERO_CARD_SOURCES } from '../../../storefront/sections/ComposedHero';

import attributeService from '../../../../services/attributeService';

function AttributePicker({ value, onChange, onCommit }) {
  const [options, setOptions] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    attributeService.getAttributes({ limit: 1000 }).then(({ data }) => {
      if (!active) return;
      setOptions([...new Set((data?.data?.rows || []).map(({ name }) => name).filter(Boolean))]);
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('error');
    });
    return () => { active = false; };
  }, []);

  return (
    <Autocomplete
      freeSolo
      size="small"
      options={options}
      loading={status === 'loading'}
      inputValue={value}
      onInputChange={(_, name, reason) => {
        if (reason === 'input' || reason === 'clear') onChange(name);
      }}
      onChange={(_, name) => {
        onChange(name || '');
        onCommit();
      }}
      onBlur={onCommit}
      renderInput={(params) => (
        <TextField {...params} label="Product attribute"
          helperText={status === 'error'
            ? 'Attributes could not be loaded. Enter the attribute name.'
            : 'Choose a catalog attribute or enter a custom name.'}
        />
      )}
    />
  );
}

const defaults = { newsletter: 'Stay in touch', heading: 'New heading', text: 'Add your text', button: 'Shop now', collection: '', brand: '', tag: '' };

export default function ComposedHeroEditor({ blocks = [], activeId, onChange, onCommit, onFocus, ImageField }) {
  const [parentId, setParentId] = useState(undefined);
  const [query, setQuery] = useState('');
  const activeRef = useRef(null);
  const collection = useHeroCategories(Boolean(activeId));
  const brand = useHeroCategories(Boolean(activeId), 'brand');
  const tag = useHeroCategories(Boolean(activeId), 'tag');
  const product = useHeroCategories(Boolean(activeId), 'product');
  const blog = useHeroCategories(Boolean(activeId), 'blog');
  const page = useHeroCategories(Boolean(activeId), 'page');
  const gallery = useHeroCategories(Boolean(activeId), 'gallery');
  const catalog = { collection, brand, tag, product, blog, page, gallery };
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const updateChildren = (parent, update, list = blocks) => {
    if (parent === null) return update(list);
    return list.map((block) => {
      if (block.type !== 'group') return block;
      return { ...block, children: block.id === parent
        ? update(block.children || [])
        : updateChildren(parent, update, block.children || []) };
    });
  };
  const commit = (next) => {
    onChange(next);
    onCommit();
  };
  const openPicker = (parent) => {
    setQuery('');
    setParentId(parent);
  };
  const add = (type) => {
    const id = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const block = { id, type, ...(defaults[type] && { text: defaults[type] }) };
    commit(updateChildren(parentId, (list) => [...list, block]));
    onFocus(id);
    setParentId(undefined);
  };

  const renderTree = (list, parent, depth) => list.map((block, index) => {
    const active = activeId === block.id;
    const source = HERO_CARD_SOURCES[block.type];
    const { categories: records, status } = catalog[block.type] || {};
    const selectedSlug = source ? block[source.field] : undefined;
    const edit = (key, value) => onChange(updateChildren(parent, (siblings) => siblings.map((item) =>
      item.id === block.id ? { ...item, [key]: value } : item)));
    const move = (step) => commit(updateChildren(parent, (siblings) => {
      const next = [...siblings];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    }));
    return (
      <Box key={block.id} ref={active ? activeRef : null} sx={{ pl: depth ? 1.25 : 0, borderLeft: depth ? '1px solid' : 0, borderColor: 'divider' }}>
        <Button size="small" variant={active ? 'contained' : 'text'} onClick={() => onFocus(block.id)}>{HERO_BLOCK_LABELS[block.type]}</Button>
        {active && (
          <Stack spacing={1.25} sx={{ py: 1 }}>
            {block.type === 'group' && (
              <TextField select size="small" label="Layout" value={block.direction || 'column'} onChange={(event) => { edit('direction', event.target.value); onCommit(); }}>
                <MenuItem value="column">Stack</MenuItem>
                <MenuItem value="row">Side by side on desktop</MenuItem>
              </TextField>
            )}
            {source && (
              <TextField select size="small" label={source.label} value={selectedSlug || ''}
                error={Boolean(selectedSlug && status === 'ready' && !records.some(({ slug }) => slug === selectedSlug))}
                helperText={status === 'error' ? 'Catalog records could not be loaded. You can still use a manual link.'
                  : status === 'loading' ? 'Loading catalog records…' : 'Manual text, link, and media override catalog defaults.'}
                onChange={(event) => { edit(source.field, event.target.value); onCommit(); }}>
                <MenuItem value="">Manual card</MenuItem>
                {selectedSlug && !records.some(({ slug }) => slug === selectedSlug) && (
                  <MenuItem value={selectedSlug}>{status === 'ready' ? 'Unavailable: ' : ''}{selectedSlug}</MenuItem>
                )}
                {records.map(({ slug, label }) => <MenuItem key={slug} value={slug}>{label}</MenuItem>)}
              </TextField>
            )}
            {block.type === 'product-attribute' && (
              <>
                <AttributePicker key={block.id} value={block.attributeName || ''} onChange={(name) => edit('attributeName', name)} onCommit={onCommit} />
                <TextField size="small" label="Prefix" value={block.prefix || ''} onChange={(event) => edit('prefix', event.target.value)} onBlur={onCommit} />
                <TextField size="small" label="Suffix" value={block.suffix || ''} onChange={(event) => edit('suffix', event.target.value)} onBlur={onCommit} />
              </>
            )}
            {block.type in defaults && <TextField size="small" label="Text" multiline={block.type === 'text'} value={block.text || ''} onChange={(event) => edit('text', event.target.value)} onBlur={onCommit} />}
            {(source || block.type === 'button') && <TextField size="small" label={source ? source.fallback + ' link' : 'Button link'} value={block.href || ''} onChange={(event) => edit('href', event.target.value)} onBlur={onCommit} />}
            {(source || block.type === 'media') && (
              <>
                {['Desktop', 'Mobile'].map((device) => {
                  const urlKey = device === 'Desktop' ? 'url' : 'mobileUrl';
                  const typeKey = device === 'Desktop' ? 'mediaType' : 'mobileMediaType';
                  return (
                    <Stack key={device} spacing={1}>
                      <TextField select size="small" label={device + ' media type'} value={block[typeKey] || 'image'} onChange={(event) => { edit(typeKey, event.target.value); onCommit(); }}>
                        <MenuItem value="image">Image</MenuItem>
                        <MenuItem value="video">Video</MenuItem>
                      </TextField>
                      {block[typeKey] === 'video'
                        ? <TextField size="small" label={device + ' video URL'} value={block[urlKey] || ''} onChange={(event) => edit(urlKey, event.target.value)} onBlur={onCommit} />
                        : <ImageField label={device + ' image'} value={block[urlKey] || ''} onChange={(value) => edit(urlKey, value)} onBlur={onCommit} />}
                    </Stack>
                  );
                })}
                <TextField size="small" label="Media description" value={block.alt || ''} onChange={(event) => edit('alt', event.target.value)} onBlur={onCommit} />
              </>
            )}
            <Stack direction="row" flexWrap="wrap">
              <Button size="small" disabled={index === 0} onClick={() => move(-1)}>Move up</Button>
              <Button size="small" disabled={index === list.length - 1} onClick={() => move(1)}>Move down</Button>
              <Button size="small" color="error" onClick={() => commit(updateChildren(parent, (siblings) => siblings.filter((item) => item.id !== block.id)))}>Remove</Button>
            </Stack>
          </Stack>
        )}
        {block.type === 'group' && (
          <>
            {renderTree(block.children || [], block.id, depth + 1)}
            <Button size="small" disabled={depth >= 3 || (block.children?.length || 0) >= 12} onClick={() => openPicker(block.id)}>Add block to group</Button>
          </>
        )}
      </Box>
    );
  });

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Blocks</Typography>
      {renderTree(blocks, null, 0)}
      <Button variant="outlined" disabled={blocks.length >= 12} onClick={() => openPicker(null)}>Add block</Button>
      <Dialog open={parentId !== undefined} onClose={() => setParentId(undefined)} fullWidth maxWidth="xs">
        <DialogTitle>Add block</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <TextField autoFocus size="small" label="Search blocks" value={query} onChange={(event) => setQuery(event.target.value)} />
            {Object.entries(HERO_BLOCK_LABELS).filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase())).map(([type, label]) =>
              <Button key={type} onClick={() => add(type)} sx={{ justifyContent: 'flex-start' }}>{label}</Button>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
