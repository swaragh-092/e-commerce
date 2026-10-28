import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import ProductTagsInput from './ProductTagsInput';
import { bulkUpdateProductTags } from '../../services/tagService';
import { getApiErrorMessage } from '../../utils/apiErrors';

// Mounted once for each selection so closing and reopening starts a fresh edit.
export default function BulkProductTagsDialog({ productIds, onClose, onSaved }) {
  const [action, setAction] = useState('add');
  const [tags, setTags] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!tags.length || tags.length > 50 || tags.some((tag) => !tag.trim() || tag.length > 100 || /[\p{Cc}\p{Cf},]/u.test(tag))) {
      setError('Choose 1–50 tags, each with 1–100 characters and no commas or control characters.');
      return;
    }
    setSaving(true); setError('');
    try {
      const result = await bulkUpdateProductTags({ productIds, action, tags });
      onSaved(result.data, action);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update product tags. Please try again.'));
      setSaving(false);
    }
  };
  return (
    <Dialog open onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="sm">
      <form onSubmit={submit}>
        <DialogTitle>Edit tags on {productIds.length} {productIds.length === 1 ? 'product' : 'products'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>Apply this change to the selected products. Their other tags will stay in place.</DialogContentText>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <FormControl fullWidth margin="dense" disabled={saving}>
            <InputLabel id="bulk-tag-action-label">Action</InputLabel>
            <Select labelId="bulk-tag-action-label" label="Action" value={action} onChange={(event) => {
              setAction(event.target.value); setTags([]); setError('');
            }}>
              <MenuItem value="add">Add tags</MenuItem>
              <MenuItem value="remove">Remove tags</MenuItem>
            </Select>
          </FormControl>
          <ProductTagsInput key={action} value={tags} onChange={setTags} disabled={saving} allowCreate={action === 'add'}
            helperText={action === 'remove' ? 'Choose existing tags to remove from the selected products.' : undefined} />
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Applying…' : 'Apply tags'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
