import { DEFAULT_PRODUCT_BLOCK_PLACEMENT, PRODUCT_BLOCK_PLACEMENTS, getProductBlockPlacement } from '../../../../utils/productBlockPlacement';
import useHeroCategories from '../../../../hooks/useHeroCategories';
import { useEffect, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem, Popover, Stack, Switch, TextField, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import BlockPickerPreview from './BlockPickerPreview';
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

const productInformationPresets = {
  care: 'Care instructions',
  delivery: 'Delivery information',
};
const blockGroups = [
  ['Product information', ['care', 'delivery', 'product-attribute', 'product-rating', 'availability', 'fulfillment']],
  ['Basic', ['button', 'heading', 'text', 'media']],
  ['Layout', ['group']],
  ['Content', ['enquiry', 'newsletter', ...Object.keys(HERO_CARD_SOURCES)]],
];
const newBlockId = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)),
  (byte) => byte.toString(16).padStart(2, '0')).join('');

export default function ComposedHeroEditor({ productInformation, orderedDetails, insertion, blocks = [], activeId, onChange, onCommit, onFocus, ImageField }) {
  const [parentId, setParentId] = useState(undefined);
  const [target, setTarget] = useState(null);
  const [pickerDepth, setPickerDepth] = useState(0);
  const [query, setQuery] = useState('');
  const [previewType, setPreviewType] = useState(null);
  const firstResultRef = useRef(null);
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
  useEffect(() => {
    if (!insertion) return;
    setTarget(insertion);
    setPickerDepth(insertion.depth || 0);
    setQuery('');
    setPreviewType(null);
    setParentId(insertion.parentId ?? null);
  }, [insertion]);

  const openPicker = (parent, depth = 0, destination = null) => {
    setTarget(destination);
    setPickerDepth(depth);
    setQuery('');
    setPreviewType(null);
    setParentId(parent);
  };
  const add = (type) => {
    const id = newBlockId();
    const preset = productInformation ? productInformationPresets[type] : undefined;
    const block = preset && type === 'care' ? { id, type: 'product-attribute', attributeName: preset, text: preset } : preset ? {
      id, type: 'group', children: [
        { id: newBlockId(), type: 'heading', text: preset },
        { id: newBlockId(), type: 'text', text: '' },
      ],
    } : { id, type, ...(defaults[type] && { text: defaults[type] }) };
    if (productInformation && parentId === null) {
      block.productPlacement = target?.placement || DEFAULT_PRODUCT_BLOCK_PLACEMENT;
    }
    const next = updateChildren(parentId, (list) => {
      const anchorIndex = list.findIndex(({ id: itemId }) => itemId === target?.afterId);
      return anchorIndex < 0
        ? (target?.atStart ? [block, ...list] : [...list, block])
        : [...list.slice(0, anchorIndex + 1), block, ...list.slice(anchorIndex + 1)];
    });
    if (productInformation && parentId === null && target?.detailAfter !== undefined) {
      onChange(next, { id, after: target.detailAfter });
      onCommit();
    } else commit(next);
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
      const from = next.findIndex(({ id: itemId }) => itemId === block.id);
      const to = next.findIndex(({ id: itemId }) => itemId === list[index + step]?.id);
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    }));
    return (
      <Box key={block.id} ref={active ? activeRef : null} sx={{ pl: depth ? 1.25 : 0, borderLeft: depth ? '1px solid' : 0, borderColor: 'divider' }}>
        <Button size="small" variant={active ? 'contained' : 'text'} onClick={() => onFocus(block.id)}>{(productInformation && block.type === 'group' && block.children?.find(({ type }) => type === 'heading')?.text)
          || (block.type === 'product-attribute' && block.text) || HERO_BLOCK_LABELS[block.type]}</Button>
        {active && (
          <Stack spacing={1.25} sx={{ py: 1 }}>
            <FormControlLabel label="Show block" control={<Switch size="small" checked={block.enabled !== false}
              onChange={(event) => { edit('enabled', event.target.checked); onCommit(); }} />} />
            {productInformation && !orderedDetails && parent === null && (
              <TextField select size="small" label="Block placement" value={getProductBlockPlacement(block)}
                onChange={(event) => { edit('productPlacement', event.target.value); onCommit(); }}>
                {Object.entries(PRODUCT_BLOCK_PLACEMENTS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
            )}
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
                <TextField size="small" label="Heading (optional)" value={block.text || ''} onChange={(event) => edit('text', event.target.value)} onBlur={onCommit} />
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
              {(!orderedDetails || parent !== null) && <>
                <Button size="small" disabled={index === 0} onClick={() => move(-1)}>Move up</Button>
                <Button size="small" disabled={index === list.length - 1} onClick={() => move(1)}>Move down</Button>
              </>}
              <Button size="small" color="error" onClick={() => commit(updateChildren(parent, (siblings) => siblings.filter((item) => item.id !== block.id)))}>Remove</Button>
            </Stack>
          </Stack>
        )}
        {block.type === 'group' && (
          <>
            {renderTree(block.children || [], block.id, depth + 1)}
            <Button size="small" disabled={depth >= 3 || (block.children?.length || 0) >= 12} onClick={() => openPicker(block.id, depth + 1)}>Add block to group</Button>
          </>
        )}
      </Box>
    );
  });

  const pickerOptions = { ...HERO_BLOCK_LABELS, ...(productInformation ? productInformationPresets : {}) };
  const groups = blockGroups.map(([label, types]) => [label, types.filter((type) => {
    if ((type === 'delivery' || type === 'group') && pickerDepth >= 3) return false;
    return pickerOptions[type]?.toLowerCase().includes(query.trim().toLowerCase());
  })]).filter(([, types]) => types.length);
  const visibleTypes = groups.flatMap(([, types]) => types);
  const activePreview = visibleTypes.includes(previewType) ? previewType : visibleTypes[0];
  const closePicker = () => setParentId(undefined);
  const pickerContent = <Stack spacing={1} sx={{ p: 1 }}>
    <TextField autoFocus size="small" label="Search blocks" value={query} onChange={(event) => { setQuery(event.target.value); setPreviewType(null); }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown' || event.nativeEvent.isComposing || !firstResultRef.current) return;
        event.preventDefault();
        firstResultRef.current.focus();
      }} />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'start', gap: 1 }}>
    <Box sx={{ maxHeight: { xs: 'min(32vh, 240px)', sm: 'min(52vh, 420px)' }, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
      {groups.length === 0 && <Typography role="status" variant="body2" sx={{ p: 1 }}>No matching blocks</Typography>}
      {groups.map(([label, types]) => <Box component="section" key={label} aria-label={label} sx={{ py: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography component="h3" variant="caption" fontWeight={700} sx={{ px: 1 }}>{label}</Typography>
        {types.map((type) => <Stack key={type} direction="row">
          <Button ref={type === visibleTypes[0] ? firstResultRef : undefined} fullWidth size="small" color="inherit" onClick={() => add(type)}
            onFocus={() => setPreviewType(type)} onPointerEnter={() => setPreviewType(type)}
            sx={{ justifyContent: 'flex-start', textTransform: 'none', bgcolor: type === activePreview ? 'action.hover' : undefined }}>{pickerOptions[type]}</Button>
          <IconButton size="small" aria-label={`Preview ${pickerOptions[type]}`} onClick={() => setPreviewType(type)}
            sx={{ display: 'none', '@media (hover: none)': { display: 'inline-flex' }, flexShrink: 0 }}><VisibilityOutlinedIcon fontSize="small" /></IconButton>
        </Stack>)}
      </Box>)}
    </Box>
    {activePreview && <BlockPickerPreview type={activePreview} label={pickerOptions[activePreview]} />}
    </Box>
  </Stack>;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Blocks</Typography>
      {orderedDetails ? <>
        <Typography variant="caption" color="text.secondary">Use the Details list in the section tree to arrange blocks.</Typography>
        {renderTree(blocks, null, 0)}
        <Button variant="outlined" disabled={blocks.length >= 12} onClick={() => openPicker(null)}>Add block</Button>
      </> : productInformation ? Object.entries(PRODUCT_BLOCK_PLACEMENTS).map(([placement, label]) => {
        const placedBlocks = blocks.filter((block) => getProductBlockPlacement(block) === placement);
        return <Stack key={placement} spacing={0.5}>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          {renderTree(placedBlocks, null, 0)}
          <Button variant="outlined" size="small" aria-label={`Add block ${label.toLowerCase()}`}
            disabled={blocks.length >= 12} onClick={() => openPicker(null, 0, { placement })}>Add block</Button>
        </Stack>;
      }) : <>
        {renderTree(blocks, null, 0)}
        <Button variant="outlined" disabled={blocks.length >= 12} onClick={() => openPicker(null)}>Add block</Button>
      </>}
      {target?.anchorEl ? <Popover open={parentId !== undefined} anchorEl={target.anchorEl} onClose={closePicker}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Add block', sx: { width: 'min(560px, calc(100vw - 32px))' } } }}>
        {pickerContent}
      </Popover> : <Dialog open={parentId !== undefined} onClose={closePicker} aria-label="Add block" fullWidth maxWidth="sm">
        <DialogTitle>Add block</DialogTitle>
        <DialogContent sx={{ p: 1 }}>{pickerContent}</DialogContent>
      </Dialog>}
    </Stack>
  );
}
