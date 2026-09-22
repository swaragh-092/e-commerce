import React from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { STANDARD_UNITS } from '../../constants/units';

/**
 * Reusable categorized Unit Selector with freeSolo custom input support.
 * Allows choosing standard measurement/packaging units or typing custom units.
 */
const UnitSelector = ({
  value = '',
  onChange,
  error = false,
  helperText = '',
  label = 'Unit',
  placeholder = 'Select or type a unit (e.g. kg, pc, litre)',
  disabled = false,
  fullWidth = true,
  margin = 'normal',
  size = 'medium',
  ...props
}) => {
  const normalizedCurrent = value ? String(value).trim() : '';

  // Find matching standard unit object if exists, otherwise treat as custom string
  const selectedOption = STANDARD_UNITS.find(
    (u) =>
      u.value.toLowerCase() === normalizedCurrent.toLowerCase() ||
      u.label.toLowerCase() === normalizedCurrent.toLowerCase()
  ) || normalizedCurrent;

  return (
    <Autocomplete
      freeSolo
      disabled={disabled}
      fullWidth={fullWidth}
      options={STANDARD_UNITS}
      groupBy={(option) => option.category || 'Other'}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option;
        return option?.label || option?.value || '';
      }}
      isOptionEqualToValue={(option, val) => {
        if (typeof val === 'string') {
          return (
            option.value.toLowerCase() === val.toLowerCase() ||
            option.label.toLowerCase() === val.toLowerCase()
          );
        }
        return option.value === val?.value;
      }}
      value={selectedOption}
      onChange={(event, newValue) => {
        if (!newValue) {
          onChange('');
        } else if (typeof newValue === 'string') {
          onChange(newValue.trim());
        } else if (newValue.value) {
          onChange(newValue.value);
        }
      }}
      onInputChange={(event, newInputValue, reason) => {
        if (reason === 'input') {
          onChange(newInputValue);
        } else if (reason === 'clear') {
          onChange('');
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label || undefined}
          margin={margin}
          size={size}
          placeholder={placeholder}
          error={Boolean(error)}
          helperText={helperText !== '' && helperText ? helperText : undefined}
          {...props}
        />

      )}
    />
  );
};

export default UnitSelector;
