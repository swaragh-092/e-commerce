import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { getAdminSession, reauthenticateAdmin, reportAdminActivity } from '../../services/adminSessionService';
import { getAdminSessionErrorCode, lockAdminSession, unlockAdminSession } from '../../services/adminSessionLock';
import EmailMfaStep from '../auth/EmailMfaStep';

const LOCK_EVENT = 'admin-session:expired';
const CHANNEL_NAME = 'admin-session:lock';
const ACTIVITY_THROTTLE_MS = 60_000;
const getUserId = user => user?._id || user?.id || user?.userId;
const broadcast = message => {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  } catch { /* BroadcastChannel is optional. */ }
};

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
  const [reauthContext, setReauthContext] = useState('');
  const userIdRef = useRef(getUserId(user));
  const lastActivityRef = useRef(0);
  const lastWarningRef = useRef(false);
  const identityRef = useRef(null);
  const expiresAtRef = useRef(0);

  const refreshStatus = useCallback(async ({ allowIdentityChange = false } = {}) => {
    try {
      const next = await getAdminSession();
      const serverNow = new Date(next.serverTime || Date.now()).getTime();
      const serverOffset = serverNow - Date.now();
      const absoluteExpiry = new Date(next.absoluteExpiresAt || next.expiresAt).getTime();
      const idleExpiry = next.idleExpiresAt
        ? new Date(next.idleExpiresAt).getTime()
        : new Date(next.lastActiveAt).getTime() + 30 * 60 * 1000;
      const expiry = Math.min(absoluteExpiry, idleExpiry);
      if (!Number.isFinite(expiry)) return null;
      if (next.reauthContext) setReauthContext(next.reauthContext);
      const identity = `${next.userId || getUserId(user) || ''}:${next.startedAt || next.createdAt || ''}`;
      if (!allowIdentityChange && identityRef.current && identityRef.current !== identity) {
        window.dispatchEvent(new Event(LOCK_EVENT));
        return null;
      }
      if (allowIdentityChange || !identityRef.current) identityRef.current = identity;
      expiresAtRef.current = expiry - serverOffset;
      const remaining = expiresAtRef.current - Date.now();
      const shouldWarn = remaining <= 120_000 && remaining > 0;
      setWarning(shouldWarn);
      if (remaining <= 0) window.dispatchEvent(new Event(LOCK_EVENT));
      if (shouldWarn && !lastWarningRef.current) {
        broadcast({ type: 'warning' });
      }
      lastWarningRef.current = shouldWarn;
      return next;
    } catch (err) {
      if (err.response?.status === 401 && getAdminSessionErrorCode(err) === 'ADMIN_SESSION_EXPIRED') window.dispatchEvent(new Event(LOCK_EVENT));
      return null;
    }
  }, [user]);

  useEffect(() => {
    userIdRef.current = getUserId(user);
    if (!user) {
      unlockAdminSession();
      identityRef.current = null;
      return undefined;
    }
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 15_000);
    const deadlineTimer = window.setInterval(() => {
      if (expiresAtRef.current && Date.now() >= expiresAtRef.current) window.dispatchEvent(new Event(LOCK_EVENT));
    }, 250);
    let channel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        if (event.data?.type === 'lock') {
          lockAdminSession();
          setLocked(true);
        }
        if (event.data?.type === 'warning') setWarning(true);
        if (event.data?.type === 'unlock') {
          refreshStatus().then(current => {
            if (!current || Date.now() >= expiresAtRef.current) return;
            unlockAdminSession();
            setLocked(false);
          });
        }
      };
    } catch { /* BroadcastChannel is optional. */ }
    const onLock = () => {
      lockAdminSession();
      setLocked(true);
      channel?.postMessage({ type: 'lock' });
    };
    window.addEventListener(LOCK_EVENT, onLock);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(deadlineTimer);
      window.removeEventListener(LOCK_EVENT, onLock);
      channel?.close();
    };
  }, [user, refreshStatus]);

  useEffect(() => {
    if (locked || !user) return undefined;
    const activity = event => {
      if (!event.isTrusted) return;
      const now = Date.now();
      if (document.visibilityState !== 'visible' || now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityRef.current = now;
      reportAdminActivity().then(() => refreshStatus()).catch(err => {
        if (getAdminSessionErrorCode(err) === 'ADMIN_SESSION_EXPIRED') window.dispatchEvent(new Event(LOCK_EVENT));
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
        : await reauthenticateAdmin(user?.email, password, reauthContext);
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
      const current = await refreshStatus({ allowIdentityChange: true });
      if (!current) {
        setError('The admin session is no longer valid.');
        return;
      }
      setLocked(false); setWarning(false); setTempToken(''); setCode(''); setPassword('');
      unlockAdminSession();
      setEmailChallenge(''); setEmailStep(false); setBackupCode(false);
      broadcast({ type: 'unlock' });
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
            const current = await refreshStatus({ allowIdentityChange: true });
            if (!current) throw new Error('The admin session is no longer valid.');
            unlockAdminSession();
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
