import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAdminSession, reportAdminActivity } from '../../services/adminSessionService';
import { activateAdminSessionGuard, lockAdminSession, setAdminSessionDeadline } from '../../services/adminSessionLock';

const WARNING_MS = 120_000;

export default function AdminSessionGuard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [warning, setWarning] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const latest = useRef({ logout, location, navigate });
  const continueSession = useRef(null);
  useEffect(() => { latest.current = { logout, location, navigate }; }, [logout, location, navigate]);
  const userId = user?.id || user?._id || user?.userId;

  useEffect(() => {
    if (!userId) return undefined;
    const deactivate = activateAdminSessionGuard();
    let active = true;
    let signingOut = false;
    let deadline = 0;
    let absolute = 0;
    let lastActivity = 0;
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('admin-session:logout') : null;

    const signOut = async (broadcast = true) => {
      if (signingOut || !active) return;
      signingOut = true;
      lockAdminSession();
      if (broadcast) channel?.postMessage(userId);
      try {
        await latest.current.logout();
      } catch {
        window.dispatchEvent(new Event('auth:unauthorized'));
      } finally {
        latest.current.navigate('/admin/login', { replace: true, state: { from: latest.current.location, sessionExpired: true } });
      }
    };
    const onExpired = () => { void signOut(); };
    if (channel) channel.onmessage = event => {
      if (event.data === userId) void signOut(false);
    };
    const tick = () => {
      if (!active || signingOut || !deadline) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) onExpired();
      else setWarning(remaining <= WARNING_MS ? (deadline === absolute ? 'maximum' : 'idle') : null);
    };
    const refresh = async () => {
      const status = await getAdminSession();
      if (!active || signingOut) return;
      const offset = Date.now() - Date.parse(status.serverTime);
      absolute = Date.parse(status.absoluteExpiresAt) + offset;
      deadline = Math.min(absolute, Date.parse(status.idleExpiresAt) + offset);
      if (status.userId !== userId || !Number.isFinite(deadline)) return onExpired();
      setAdminSessionDeadline(deadline);
      tick();
    };
    const onActivity = event => {
      if (!event.isTrusted || document.visibilityState !== 'visible' || signingOut
          || (deadline && deadline - Date.now() <= WARNING_MS)
          || Date.now() - lastActivity < 60_000) return;
      lastActivity = Date.now();
      reportAdminActivity().then(refresh).catch(() => {});
    };
    const onContinue = async () => {
      if (signingOut) return;
      setBusy(true);
      setError(false);
      try {
        await reportAdminActivity();
        await refresh();
      } catch {
        if (active && !signingOut) setError(true);
      } finally {
        if (active) setBusy(false);
      }
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'touchmove'];
    events.forEach(type => window.addEventListener(type, onActivity, { passive: true }));
    window.addEventListener('admin-session:expired', onExpired);
    continueSession.current = onContinue;
    void refresh().catch(() => {});
    const statusTimer = window.setInterval(() => { if (!signingOut) void refresh().catch(() => {}); }, 15_000);
    const timer = window.setInterval(tick, 250);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(statusTimer);
      events.forEach(type => window.removeEventListener(type, onActivity));
      window.removeEventListener('admin-session:expired', onExpired);
      continueSession.current = null;
      channel?.close();
      deactivate();
    };
  }, [userId]);

  return (
    <Dialog open={Boolean(warning)} disableEscapeKeyDown aria-labelledby="admin-expiry-title">
      <DialogTitle id="admin-expiry-title">Your admin session is about to expire</DialogTitle>
      <DialogContent>
        {warning === 'maximum'
          ? 'You’ve reached the end of your 12-hour session. You’ll need to sign in again.'
          : 'Select Stay signed in to continue. Otherwise, you’ll be signed out.'}
        {' Unsaved changes may be lost.'}
        {error && <Alert severity="error">Could not extend your session. Try again before it expires.</Alert>}
      </DialogContent>
      {warning === 'idle' && <DialogActions>
        <Button autoFocus variant="contained" disabled={busy} onClick={() => continueSession.current?.()}>
          {busy ? 'Extending session…' : 'Stay signed in'}
        </Button>
      </DialogActions>}
    </Dialog>
  );
}
