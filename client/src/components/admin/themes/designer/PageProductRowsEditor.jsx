import StaffPicksEditor from './StaffPicksEditor';
import { Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const SOURCES = [
  { value: 'staffPicks', label: 'Staff Picks' },
  { value: 'trending', label: 'Trending This Week' },
  { value: 'bestSellers', label: 'Best sellers' },
  { value: 'mostViewed', label: 'Most viewed' },
  { value: 'featured', label: 'Featured products' },
  { value: 'newest', label: 'New arrivals' },
  { value: 'sale', label: 'On sale' },
];

const createRow = () => ({
  id: `page-products-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: 'product-row',
  title: 'Featured products',
  source: 'featured',
  pagePosition: 'below',
  count: 8,
  layout: 'carousel',
  enabled: true,
});

export default function PageProductRowsEditor({ rows = [], onChange, page }) {
  const productRows = Array.isArray(rows) ? rows : [];
  const moveRow = (index, offset) => {
    const next = [...productRows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  const updateRow = (id, patch) => onChange(productRows.map(row => row.id === id ? { ...row, ...patch } : row));
  return <Box sx={{ mt: 2 }}>
    <Divider sx={{ mb: 1.5 }} />
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
      <Box>
        <Typography variant="subtitle2" fontWeight={800}>Product sections</Typography>
        <Typography variant="caption" color="text.secondary">Add best sellers, trending, featured, new, or sale rows to this page.</Typography>
      </Box>
      <Button size="small" startIcon={<AddIcon />} disabled={productRows.length >= 6} onClick={() => onChange([...productRows, createRow()])}>Add product row</Button>
    </Stack>
    {productRows.map((row, index) => <Stack key={row.id || index} spacing={1.25} sx={{ p: 1.5, mb: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField size="small" fullWidth label="Section title" value={row.title || ''} onChange={event => updateRow(row.id, { title: event.target.value })} />
        <IconButton size="small" aria-label={`Remove ${row.title || 'product row'}`} onClick={() => onChange(productRows.filter(item => item.id !== row.id))}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </Stack>
      <FormControl size="small" fullWidth>
        <InputLabel id={`product-row-source-${row.id}`}>Products to show</InputLabel>
        <Select labelId={`product-row-source-${row.id}`} label="Products to show" value={row.source || 'featured'} onChange={(event) => {
          const source = event.target.value;
          const previousLabel = SOURCES.find((item) => item.value === row.source)?.label;
          const title = row.title && row.title !== previousLabel ? row.title : SOURCES.find((item) => item.value === source).label;
          updateRow(row.id, { source, title });
        }}>
          {SOURCES.map(source => <MenuItem key={source.value} value={source.value}>{source.label}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField select size="small" label="Position on page" value={row.pagePosition || 'below'}
        onChange={(event) => updateRow(row.id, { pagePosition: event.target.value })}>
        <MenuItem value="above">Above page content</MenuItem>
        <MenuItem value="below">Below page content</MenuItem>
      </TextField>
      {page === 'category' && row.source !== 'staffPicks' && (
        <TextField select size="small" label="Product scope" value={row.productScope || 'category'}
          onChange={(event) => updateRow(row.id, { productScope: event.target.value })}>
          <MenuItem value="category">This category</MenuItem>
          <MenuItem value="store">Entire store</MenuItem>
        </TextField>
      )}
      {row.source === 'staffPicks' && (
        <StaffPicksEditor ids={row.productIds || []} onChange={(productIds) => updateRow(row.id, { productIds })} />
      )}
      <Stack direction="row" spacing={1}>
        <Button disabled={index === 0} onClick={() => moveRow(index, -1)}>Move up</Button>
        <Button disabled={index === productRows.length - 1} onClick={() => moveRow(index, 1)}>Move down</Button>
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField disabled={row.source === 'staffPicks'} size="small" type="number" label="Product count" value={row.count || 8} inputProps={{ min: 1, max: 24 }} onChange={event => updateRow(row.id, { count: Math.min(24, Math.max(1, Number.parseInt(event.target.value, 10) || 1)) })} sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ flex: 1 }}>
          <InputLabel id={`product-row-layout-${row.id}`}>Layout</InputLabel>
          <Select labelId={`product-row-layout-${row.id}`} label="Layout" value={row.layout || 'carousel'} onChange={event => updateRow(row.id, { layout: event.target.value })}>
            <MenuItem value="carousel">Carousel</MenuItem><MenuItem value="grid">Grid</MenuItem><MenuItem value="grid-compact">Compact grid</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Stack>)}
    {!productRows.length && <Typography variant="caption" color="text.secondary">No product rows yet.</Typography>}
  </Box>;
}
