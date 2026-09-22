export const STANDARD_UNITS = [
  // Count / Packaging
  { value: 'pc', label: 'Piece (pc)', category: 'Count / Packaging' },
  { value: 'pack', label: 'Pack (pk)', category: 'Count / Packaging' },
  { value: 'box', label: 'Box', category: 'Count / Packaging' },
  { value: 'set', label: 'Set', category: 'Count / Packaging' },
  { value: 'pair', label: 'Pair', category: 'Count / Packaging' },
  { value: 'dozen', label: 'Dozen (dz)', category: 'Count / Packaging' },
  { value: 'bottle', label: 'Bottle', category: 'Count / Packaging' },
  { value: 'can', label: 'Can', category: 'Count / Packaging' },
  { value: 'bundle', label: 'Bundle', category: 'Count / Packaging' },
  { value: 'roll', label: 'Roll', category: 'Count / Packaging' },
  { value: 'bag', label: 'Bag', category: 'Count / Packaging' },
  { value: 'carton', label: 'Carton', category: 'Count / Packaging' },

  // Weight
  { value: 'kg', label: 'Kilogram (kg)', category: 'Weight' },
  { value: 'g', label: 'Gram (g)', category: 'Weight' },
  { value: 'mg', label: 'Milligram (mg)', category: 'Weight' },
  { value: 'lb', label: 'Pound (lb)', category: 'Weight' },
  { value: 'oz', label: 'Ounce (oz)', category: 'Weight' },

  // Volume / Liquid
  { value: 'L', label: 'Litre (L)', category: 'Volume' },
  { value: 'ml', label: 'Millilitre (ml)', category: 'Volume' },
  { value: 'gal', label: 'Gallon (gal)', category: 'Volume' },
  { value: 'fl oz', label: 'Fluid Ounce (fl oz)', category: 'Volume' },

  // Length / Area
  { value: 'm', label: 'Metre (m)', category: 'Length & Area' },
  { value: 'cm', label: 'Centimetre (cm)', category: 'Length & Area' },
  { value: 'mm', label: 'Millimetre (mm)', category: 'Length & Area' },
  { value: 'ft', label: 'Foot (ft)', category: 'Length & Area' },
  { value: 'in', label: 'Inch (in)', category: 'Length & Area' },
  { value: 'sq ft', label: 'Square Foot (sq ft)', category: 'Length & Area' },
  { value: 'sq m', label: 'Square Metre (sq m)', category: 'Length & Area' },
];

/**
 * Returns formatted label for unit or custom string fallback.
 */
export const getUnitLabel = (unitValue) => {
  if (!unitValue) return '';
  const trimmed = String(unitValue).trim();
  const found = STANDARD_UNITS.find(
    (u) => u.value.toLowerCase() === trimmed.toLowerCase() || u.label.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.label : trimmed;
};

/**
 * Normalizes user input or selected option to canonical unit value string.
 */
export const normalizeUnitValue = (unitValue) => {
  if (!unitValue) return '';
  const trimmed = String(unitValue).trim();
  const found = STANDARD_UNITS.find(
    (u) => u.value.toLowerCase() === trimmed.toLowerCase() || u.label.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.value : trimmed;
};
