import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Stack, TextField } from '@mui/material';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function StaffAssignment({ kind, recordId }) {
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(kind === 'orders' ? PERMISSIONS.ORDERS_UPDATE_STATUS : PERMISSIONS.ENQUIRIES_MANAGE);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!canAssign) return;
    let active = true;
    setBusy(true); setStatus(null);
    api.get(`/notifications/assignments/${kind}/${recordId}`).then((response) => {
      if (!active) return;
      setCandidates(response.data.data.candidates);
      setSelectedId(response.data.data.assignedUserId);
    }).catch((error) => { if (active) setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not load staff assignments.') }); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [canAssign, kind, recordId]);
  if (!canAssign) return null;
  const save = async () => {
    setBusy(true); setStatus(null);
    try {
      await api.put(`/notifications/assignments/${kind}/${recordId}`, { assignedUserId: selectedId });
      setStatus({ type: 'success', message: selectedId ? 'Staff assignment saved.' : 'Staff assignment cleared.' });
    } catch (error) { setStatus({ type: 'error', message: getApiErrorMessage(error, 'Could not save assignment.') }); }
    finally { setBusy(false); }
  };
  return <Box sx={{ mt: 2, mb: 2, maxWidth: 500 }}>
    {status && <Alert severity={status.type} sx={{ mb: 1 }}>{status.message}</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Autocomplete fullWidth size="small" options={candidates} disabled={busy}
        value={candidates.find((user) => user.id === selectedId) || null}
        getOptionLabel={(user) => `${user.name} (${user.email})`} isOptionEqualToValue={(option, value) => option.id === value.id}
        onChange={(_, user) => setSelectedId(user?.id || null)}
        renderInput={(params) => <TextField {...params} label="Assigned staff" helperText={selectedId && !candidates.some((user) => user.id === selectedId) ? 'Current assignee is no longer eligible. Select staff or clear the assignment.' : 'Staff receive an email when assigned.'} />} />
      <Button variant="outlined" disabled={busy} onClick={save} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{busy ? 'Loading…' : 'Save assignment'}</Button>
    </Stack>
  </Box>;
}
