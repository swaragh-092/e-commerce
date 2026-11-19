import { Box, Stack, Typography } from '@mui/material';

const shapes = {
  copy: [[0, 0, 54, 8, 2], [0, 14, 66, 4, 1], [0, 23, 45, 4, 1], [0, 35, 28, 10, 2]],
  image: [[0, 0, 88, 64, 0]],
};

function getLayout(type, variant) {
  const place = (group, x, y) => shapes[group].map(([dx, dy, w, h, tone]) => [x + dx, y + dy, w, h, tone]);
  if (type === 'editorial-image-text' || variant?.startsWith('split')) {
    const right = variant === 'image-right';
    return [...place('image', right ? 100 : 12, 16), ...place('copy', right ? 16 : 111, 26)];
  }
  if (type.includes('hero')) {
    return [[10, 10, 180, 76, 0], ...place('copy', variant === 'centered' ? 67 : 23, 26)];
  }
  if (type === 'faq' || variant === 'banner-stack') {
    return [15, 39, 63].flatMap((y) => [[15, y, 170, 18, 0], [23, y + 7, 77, 4, 1], [172, y + 6, 6, 6, 2]]);
  }
  if (type === 'newsletter-signup' || type === 'countdown-sale') {
    return [[47, 23, 106, 9, 2], [60, 39, 80, 4, 1], [32, 56, 90, 17, 0], [127, 56, 41, 17, 2]];
  }
  const columns = ['grid-compact', 'compact-chips'].includes(variant) ? 4 : 3;
  const rows = ['grid', 'grid-compact', 'image-tiles', 'card-grid'].includes(variant) ? 2 : 1;
  const width = 174 / columns;
  return [[12, 13, 68, 8, 2], ...Array.from({ length: columns * rows }, (_, i) => {
    const x = 12 + (i % columns) * width;
    const y = 29 + Math.floor(i / columns) * 28;
    const height = rows === 2 ? 17 : 37;
    return [[x, y, width - 5, height, 0], [x, y + height + 4, (width - 5) * 0.65, 4, 1]];
  }).flat()];
}

export default function SectionLayoutPreview({ option }) {
  if (!option) return null;
  return <Stack component="aside" aria-label="Section layout preview" spacing={0.75}
    sx={{ bgcolor: 'action.hover', p: 1.25, minWidth: 0, borderRadius: 1.5 }}>
    <Typography variant="caption" color="text.secondary">Layout preview</Typography>
    <Box component="svg" viewBox="0 0 200 96" aria-hidden="true"
      sx={(theme) => ({ display: 'block', width: '100%', maxHeight: { xs: 110, sm: 165 }, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1,
        '& .tone-0': { fill: theme.palette.action.selected }, '& .tone-1': { fill: theme.palette.text.secondary }, '& .tone-2': { fill: theme.palette.primary.main } })}>
      {getLayout(option.type, option.variant).map(([x, y, width, height, tone], index) => (
        <rect key={index} x={x} y={y} width={width} height={height} rx={2} className={`tone-${tone}`} />
      ))}
    </Box>
    <Typography variant="subtitle2" component="h3">{option.label}</Typography>
    {option.description && <Typography variant="caption" color="text.secondary">{option.description}</Typography>}
  </Stack>;
}
