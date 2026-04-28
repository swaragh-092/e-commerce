export const checkBool = (val, fallback = true) =>
  val === undefined || val === null ? fallback : val !== false && val !== 'false' && val !== '0';

export const sizeToGrid = {
  small: { xs: 12, md: 6, xl: 3 },
  medium: { xs: 12, lg: 4 },
  large: { xs: 12, lg: 8 },
  full: { xs: 12 },
};

export const densitySpacing = {
  compact: { page: 2, grid: 2, panel: 2 },
  comfortable: { page: 3, grid: 3, panel: 3 },
  spacious: { page: 4, grid: 4, panel: 4 },
};

export const getPanelSx = (spacing) => ({
  p: spacing.panel,
  borderRadius: 3,
  border: '1px solid',
  borderColor: 'divider',
  height: '100%',
});
