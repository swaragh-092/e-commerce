import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { getAdminSession, reportAdminActivity } from '../../services/adminSessionService';
import EmailMfaStep from '../auth/EmailMfaStep';

const LOCK_EVENT = 'admin-session:expired';
const CHANNEL_NAME = 'admin-session:lock';
const ACTIVITY_THROTTLE_MS = 60_000;
const getUserId = user => user?._id || user?.id || user?.userId;

const AdminSessionGuard = () => {
  const { user, login, verifyTwoFactor, finalizeAuthenticatedSession } = useAuth();
  const [locked, setLocked] = useState(false);
  const [warning, setWarning] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [emailChallenge, setEmailChallenge] = useState('');
  const [emailStep, setEmailStep] = useState(false);
  const [backupCode, setBackupCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const userIdRef = useRef(getUserId(user));
  const lastActivityRef = useRef(0);
  const lastWarningRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getAdminSession();
      const serverNow = new Date(next.serverTime || Date.now()).getTime();
      const absoluteExpiry = new Date(next.absoluteExpiresAt || next.expiresAt).getTime();
      const idleExpiry = next.idleExpiresAt
        ? new Date(next.idleExpiresAt).getTime()
        : new Date(next.lastActiveAt).getTime() + 30 * 60 * 1000;
      const expiry = Math.min(absoluteExpiry, idleExpiry);
      const remaining = expiry - serverNow;
      const shouldWarn = remaining <= 120_000 && remaining > 0;
      setWarning(shouldWarn);
      if (remaining <= 0) window.dispatchEvent(new Event(LOCK_EVENT));
      if (shouldWarn && !lastWarningRef.current) {
        try { new BroadcastChannel(CHANNEL_NAME).postMessage({ type: 'warning' }); } catch { /* Optional cross-tab hint. */ }
      }
      lastWarningRef.current = shouldWarn;
      return next;
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.code === 'ADMIN_SESSION_EXPIRED') window.dispatchEvent(new Event(LOCK_EVENT));
      return null;
    }
  }, []);

  useEffect(() => {
    userIdRef.current = getUserId(user);
    if (!user) return undefined;
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 15_000);
    let channel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        if (event.data?.type === 'lock') setLocked(true);
        if (event.data?.type === 'warning') setWarning(true);
      };
    } catch { /* BroadcastChannel is optional. */ }
    const onLock = () => {
      setLocked(true);
      channel?.postMessage({ type: 'lock' });
    };
    window.addEventListener(LOCK_EVENT, onLock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(LOCK_EVENT, onLock);
      channel?.close();
    };
  }, [user, refreshStatus]);

  useEffect(() => {
    if (locked || !user) return undefined;
    const activity = event => {
      if (!event.isTrusted) return;
      const now = Date.now();
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      reportAdminActivity().catch(err => {
        if (err.response?.data?.code === 'ADMIN_SESSION_EXPIRED') window.dispatchEvent(new Event(LOCK_EVENT));
      });
    };
    const types = ['pointerdown', 'keydown', 'touchstart'];
    types.forEach(type => window.addEventListener(type, activity, { passive: true }));
    return () => types.forEach(type => window.removeEventListener(type, activity));
  }, [locked, user]);

  const reauthenticate = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = tempToken
        ? await verifyTwoFactor(tempToken, code)
        : await login(user?.email, password);
      if (result.requiresTwoFactor) {
        setTempToken(result.tempToken);
        setEmailChallenge(result.emailChallenge || '');
        return;
      }
      const verifiedUser = result.user || await finalizeAuthenticatedSession();
      if (!userIdRef.current || getUserId(verifiedUser) !== userIdRef.current) {
        setError('Sign in with the same account to unlock this session.');
        return;
      }
      const current = await refreshStatus();
      if (!current) {
        setError('The admin session is no longer valid.');
        return;
      }
      setLocked(false); setWarning(false); setTempToken(''); setCode(''); setPassword('');
      setEmailChallenge(''); setEmailStep(false); setBackupCode(false);
      try { new BroadcastChannel(CHANNEL_NAME).postMessage({ type: 'unlock' }); } catch { /* Optional cross-tab hint. */ }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to reauthenticate.');
    } finally { setBusy(false); }
  };

  return <>
    {warning && !locked && <Alert severity="warning" sx={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1500, boxShadow: 3 }}>
      Your admin session is about to expire. Use the admin area to continue working.
    </Alert>}
    <Dialog open={locked} disableEscapeKeyDown>
      <Box component="form" onSubmit={reauthenticate}>
        <DialogTitle>Admin session locked</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Your admin session expired. Reauthenticate with the same account to continue; your open work remains in place.</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {emailStep ? <EmailMfaStep challenge={emailChallenge} onBack={() => setEmailStep(false)} onComplete={async () => {
            const verifiedUser = await finalizeAuthenticatedSession();
            if (getUserId(verifiedUser) !== userIdRef.current) throw new Error('Sign in with the same account to unlock this session.');
            const current = await refreshStatus();
            if (!current) throw new Error('The admin session is no longer valid.');
            setLocked(false); setWarning(false); setPassword(''); setEmailChallenge(''); setTempToken('');
          }} /> : tempToken ? <>
            <TextField autoFocus fullWidth label={backupCode ? 'Backup code' : 'Verification code'} value={code} onChange={e => setCode(backupCode ? e.target.value.replace(/[^a-f0-9]/gi, '').toLowerCase().slice(0, 8) : e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <Button onClick={() => { setBackupCode(!backupCode); setCode(''); }}>{backupCode ? 'Use authenticator code' : 'Use backup code'}</Button>
            {emailChallenge && <Button onClick={() => setEmailStep(true)}>Use an email code</Button>}
          </> : <TextField autoFocus fullWidth type="password" label="Password" value={password} onChange={e => setPassword(e.target.value)} />}
        </DialogContent>
        {!emailStep && <DialogActions sx={{ px: 3, pb: 2 }}><Button type="submit" variant="contained" disabled={busy || (tempToken ? !code : !password)}>{busy ? <CircularProgress size={20} /> : 'Unlock'}</Button></DialogActions>}
      </Box>
    </Dialog>
  </>;
};

export default AdminSessionGuard;
