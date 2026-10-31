import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function StaffAssignment({ kind, recordId }) {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(kind === 'orders' ? PERMISSIONS.ORDERS_UPDATE_STATUS : PERMISSIONS.ENQUIRIES_MANAGE);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    setBusy(true); setLoaded(false); setStatus(null);
    api.get(`/notifications/assignments/${kind}/${recordId}`).then((response) => {
      if (!active) return;
      setCandidates(response.data.data.candidates);
      setSelectedId(response.data.data.assignedUserId || null);
      setSavedId(response.data.data.assignedUserId || null);
      setLoaded(true);
    }).catch((error) => { if (active) setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not load staff assignments.') }); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [canAssign, kind, recordId]);
  if (!canAssign) return null;
  const save = async () => {
    if (busy || !loaded || selectedId === savedId) return;
    setBusy(true); setStatus(null);
    try {
      await api.put(`/notifications/assignments/${kind}/${recordId}`, { assignedUserId: selectedId });
      setSavedId(selectedId);
      setStatus({ type: 'success', message: 'Assignment saved.' });
    } catch (error) { setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not save assignment.') }); }
    finally { setBusy(false); }
  };
  return <Box sx={{ mt: 2, mb: 2, width: '100%' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Autocomplete fullWidth size="small" options={candidates} disabled={busy || !loaded}
        value={candidates.find((user) => user.id === selectedId) || null}
        getOptionLabel={(user) => user.name || user.email} isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, user) => { setSelectedId(user?.id || null); setStatus(null); }}
        renderOption={(props, user) => <li {...props} key={user.id}><Box><Typography sx={{ whiteSpace: 'normal' }}>{user.name}</Typography><Typography variant="caption" color="text.secondary">{user.email}</Typography></Box></li>}
        renderInput={(params) => <TextField {...params} label="Assigned staff" helperText={selectedId && !candidates.some((user) => user.id === selectedId) ? 'Current assignee is no longer eligible. Select staff or clear the assignment.' : 'Staff receive an email when assigned.'} />} />
      <Button variant="outlined" disabled={busy || !loaded || selectedId === savedId} onClick={save} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{busy ? 'Loading…' : 'Save assignment'}</Button>
    </Stack>
    {selectedId && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{candidates.find((user) => user.id === selectedId)?.email}</Typography>}
    {status && <Alert severity={status.type} sx={{ mt: 1 }} role="status">{status.message}</Alert>}
  </Box>;
}
