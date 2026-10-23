import React, { useId } from 'react';
import { FormControl, FormHelperText, InputLabel, MenuItem, Select } from '@mui/material';
import { useUnitCatalog } from '../../context/UnitCatalogContext';

const UnitCategorySelector = ({ value = '', onChange, disabled = false, helperText = 'Optional. Choose units for individual values after creating the attribute.' }) => {
  const { categories, loading, error } = useUnitCatalog();
  const labelId = useId();
  const helperId = useId();
  const options = value && !categories.includes(value) ? [...categories, value] : categories;
  return <FormControl fullWidth size="small" disabled={disabled || loading || Boolean(error)}>
    <InputLabel id={labelId}>Unit category</InputLabel>
    <Select labelId={labelId} label="Unit category" value={value} onChange={(event) => onChange(event.target.value)} inputProps={{ 'aria-describedby': helperId }}>
      <MenuItem value="">No unit category</MenuItem>
      {options.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
    </Select>
    <FormHelperText id={helperId}>{error ? 'Unit categories could not be loaded. Reopen Unit settings to retry.' : helperText}</FormHelperText>
  </FormControl>;
};

export default UnitCategorySelector;
