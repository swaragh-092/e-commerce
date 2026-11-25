import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { createNamedDesignDraft, getNamedDesignDrafts, renameNamedDesignDraft } from '../../../services/settingsService';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const editorPath = (draftKey) => `/admin/store-designer?draftKey=${encodeURIComponent(draftKey)}`;

export default function NamedDraftsPanel() {
  const [drafts, setDrafts] = useState(null);
  const [action, setAction] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    getNamedDesignDrafts().then((items) => {
      if (active) setDrafts(items);
    }).catch((err) => {
      if (active) setError(getApiErrorMessage(err, 'Could not load named drafts.'));
    });
    return () => { active = false; };
  }, []);

  const open = (type, draft) => {
    setError('');
    setAction({ type, draft });
    setName(draft?.name ? `${draft.name}${type === 'duplicate' ? ' copy' : ''}` : '');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const saved = action.type === 'rename'
        ? await renameNamedDesignDraft(action.draft.draftKey, name.trim(), action.draft.revision)
        : await createNamedDesignDraft(name.trim(), action.draft?.draftKey);
      setDrafts((current) => [saved, ...(current || []).filter(({ draftKey }) => draftKey !== saved.draftKey)]);
      setAction(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the named draft.'));
    } finally {
      setSaving(false);
    }
  };

  const copyPreview = async (draftKey) => {
    try {
      await navigator.clipboard.writeText(new URL(`${editorPath(draftKey)}&previewDraft=1`, window.location.origin).href);
      setStatus('Preview link copied. The recipient needs Store Designer access.');
    } catch {
      setStatus('Open Preview and copy its address from your browser.');
    }
  };

  return <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
      <Typography variant="h6">Named theme drafts</Typography>
      <Button onClick={() => open('create')}>New draft</Button>
    </Stack>
    {error && !action && <Alert severity="error">{error}</Alert>}
    {status && <Typography role="status" variant="body2">{status}</Typography>}
    {drafts?.map((draft) => <Stack key={draft.draftKey} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography sx={{ flex: 1 }}>{draft.name}</Typography>
      <Button component={Link} to={editorPath(draft.draftKey)}>Edit draft</Button>
      <Button component={Link} to={`${editorPath(draft.draftKey)}&previewDraft=1`}>Preview</Button>
      <Button onClick={() => copyPreview(draft.draftKey)}>Copy preview link</Button>
      <Button onClick={() => open('rename', draft)}>Rename</Button>
      <Button onClick={() => open('duplicate', draft)}>Duplicate</Button>
    </Stack>)}
    {drafts?.length === 0 && <Typography color="text.secondary" variant="body2">Create a named draft to work independently of the current design draft.</Typography>}
    <Dialog open={Boolean(action)} onClose={() => !saving && setAction(null)} fullWidth maxWidth="xs">
      <DialogTitle>{action?.type === 'rename' ? 'Rename draft' : action?.type === 'duplicate' ? 'Duplicate draft' : 'New theme draft'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        <TextField autoFocus name="draftName" label="Draft name" value={name} onChange={(event) => setName(event.target.value)}
          inputProps={{ maxLength: 100 }} margin="dense" fullWidth />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setAction(null)} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  </Paper>;
}
