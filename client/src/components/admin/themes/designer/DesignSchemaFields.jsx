import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { isDesignControlVisible } from '../../../../utils/designRegistry';

const getFieldValue = (value, field) => {
  const rawValue = value?.[field.key] ?? field.defaultValue ?? '';
  if (field.type === 'boolean' && (rawValue === 'true' || rawValue === 'false')) return rawValue === 'true';
  if (field.type === 'number' && rawValue !== '') return Number(rawValue);
  if (field.type === 'select') {
    const matchingOption = (field.options || []).find((option) => String(option.value) === String(rawValue));
    return matchingOption?.value ?? rawValue;
  }
  return rawValue;
};

const SchemaField = ({ field, value, onChange }) => {
  if (!isDesignControlVisible(field, value)) return null;

  const currentValue = getFieldValue(value, field);

  if (field.type === 'boolean') {
    return (
      <FormControlLabel
        control={(
          <Switch
            size="small"
            checked={currentValue !== false}
            onChange={(event) => onChange(field.key, event.target.checked)}
          />
        )}
        label={field.label}
        sx={{ m: 0, minHeight: 38, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{field.label}</InputLabel>
        <Select
          label={field.label}
          value={currentValue}
          onChange={(event) => onChange(field.key, event.target.value)}
        >
          {(field.options || []).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      type={field.type || 'text'}
      label={field.label}
      value={currentValue}
      onChange={(event) => onChange(
        field.key,
        field.type === 'number'
          ? (event.target.value === '' ? '' : Number(event.target.value))
          : (field.maxLength ? event.target.value.slice(0, field.maxLength) : event.target.value)
      )}
      multiline={Boolean(field.multiline)}
      rows={field.multiline ? 2 : undefined}
      helperText={field.maxLength ? `${String(currentValue || '').length}/${field.maxLength}` : field.helperText}
      placeholder={field.placeholder}
      inputProps={{
        ...(field.type === 'number' ? { min: field.min, max: field.max } : {}),
        ...(field.maxLength ? { maxLength: field.maxLength } : {}),
      }}
      InputLabelProps={field.type === 'color' ? { shrink: true } : undefined}
    />
  );
};

/**
 * Render a page/component editor from the canonical design control schema.
 * The callback keeps the existing shallow settings object contract so this can
 * be introduced incrementally without changing draft or API persistence.
 */
export const DesignSchemaFields = ({ schema, value = {}, onChange }) => {
  if (!schema) return null;

  const update = (key, nextValue) => onChange({ ...value, [key]: nextValue });

  return (
    <Stack spacing={2}>
      {schema.groups.map((group) => (
        <Box key={group.key}>
          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
            {group.label}
          </Typography>
          <Stack spacing={1.25}>
            {group.fields.map((field) => (
              <SchemaField key={field.key} field={field} value={value} onChange={update} />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};
