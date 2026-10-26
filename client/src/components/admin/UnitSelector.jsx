import React, { useId, useState } from 'react';
import { Autocomplete, Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { useUnitCatalog } from '../../context/UnitCatalogContext';

const UnitSelector = ({
  value = '', onChange, error = false, helperText = '', label = 'Unit',
  placeholder = 'Select a unit', disabled = false, fullWidth = true,
  margin = 'normal', size = 'medium', category: fixedCategory, ...props
}) => {
  const { units, loading, error: catalogError } = useUnitCatalog();
  const categoryId = useId();
  const helperId = useId();
  const [emptyCategory, setEmptyCategory] = useState('');
  const raw = String(value || '').trim();
  const matching = units.find((unit) => unit.value.toLowerCase() === raw.toLowerCase()) ||
    units.find((unit) => unit.label.toLowerCase() === raw.toLowerCase());
  // Legacy/custom values remain visible even if their definition is hidden or
  // missing. Only an explicit selection changes the stored unit string.
  const selected = raw ? matching || { value: raw, label: raw, category: 'Existing unit' } : null;
  const category = fixedCategory !== undefined ? fixedCategory : selected?.category || emptyCategory;
  const outsideCategory = fixedCategory !== undefined && selected && selected.category !== category;
  const categories = [...new Set(units.filter((unit) => unit.enabled).map((unit) => unit.category))];
  if (category && !categories.includes(category)) categories.push(category);
  const options = units.filter((unit) => unit.enabled && unit.category === category);
  if (selected && !outsideCategory && !options.some((unit) => unit.value === selected.value)) options.push(selected);
  const categoryLabel = label ? `${label} category` : 'Unit category';
  const hasHelper = Boolean(helperText || catalogError || outsideCategory || (selected && !matching?.enabled));

  return (
    <Box sx={{ width: fullWidth ? '100%' : undefined, mt: margin === 'normal' ? 2 : margin === 'dense' ? 1 : 0, mb: margin === 'none' ? 0 : 1 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: fixedCategory !== undefined ? 'minmax(0, 1fr)' : { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 1.5 }}>
        {fixedCategory === undefined && <FormControl fullWidth size={size} disabled={disabled || loading}>
          <InputLabel id={categoryId}>{categoryLabel}</InputLabel>
          <Select
            labelId={categoryId} label={categoryLabel} value={category}
            onChange={(event) => {
              setEmptyCategory(event.target.value);
              onChange('');
            }}
          >
            <MenuItem value="">No unit</MenuItem>
            {categories.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
          </Select>
        </FormControl>}
        <Autocomplete
          size={size} fullWidth disabled={disabled || loading || !category}
          options={options} value={outsideCategory ? null : selected}
          getOptionLabel={(option) => option.label}
          renderOption={({ key, ...optionProps }, option) => <li key={option.value} {...optionProps}>{option.label}</li>}
          isOptionEqualToValue={(option, current) => option.value === current.value}
          onChange={(_, option) => {
            setEmptyCategory(category);
            onChange(option?.value || '');
          }}
          noOptionsText="No units available. Add one in Unit settings."
          renderInput={(params) => <TextField {...params} {...props} inputProps={{ ...params.inputProps, 'aria-describedby': hasHelper ? helperId : undefined }} label={label || 'Unit'} placeholder={category ? placeholder : 'Choose a category first'} error={Boolean(error)} />}
        />
      </Box>
      {hasHelper && (
        <FormHelperText id={helperId} error={Boolean(error)}>
          {helperText}
          {catalogError ? ' Custom units could not be loaded. Your existing unit is preserved.' : outsideCategory ? ` Existing unit (${raw}) is preserved until you select a replacement.` : selected && !matching?.enabled ? ' Existing unit is preserved; it is not available for new selections.' : ''}
        </FormHelperText>
      )}
    </Box>
  );
};

export default UnitSelector;
