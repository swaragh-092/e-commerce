import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

const unwrap = ({ data }) => data.data;
const money = (paise) => paise == null ? '—' : `₹${(paise / 100).toFixed(2)}`;
const errorText = (error) => error.response?.data?.error?.message || error.message;
const date = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : '—';

export default function GiftCardsPage() {
    const { hasPermission } = useAuth();
    const canIssue = hasPermission(PERMISSIONS.GIFT_CARDS_ISSUE);
    const canManage = hasPermission(PERMISSIONS.GIFT_CARDS_MANAGE);
    const canRefund = hasPermission(PERMISSIONS.GIFT_CARDS_REFUND);
    const [policy, setPolicy] = useState(null);
    const [issuance, setIssuance] = useState(null);
    const [issuedId, setIssuedId] = useState(null);
    const [rows, setRows] = useState([]);
    const [health, setHealth] = useState(null);
    const [ledger, setLedger] = useState(null);
    const [action, setAction] = useState(null);
    const [reason, setReason] = useState('');
    const [email, setEmail] = useState('');
    const [filter, setFilter] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async (search = '') => {
        setLoading(true);
        try {
        const [settings, cards, health] = await Promise.all([
            api.get('/gift-cards/admin/policy').then(unwrap),
            api.get('/gift-cards/admin/cards', { params: { search } }).then(unwrap),
            api.get('/gift-cards/admin/health').then(unwrap),
        ]);
        setPolicy(settings);
        setRows(cards);
        setHealth(health);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { refresh().catch((error) => setError(errorText(error))); }, [refresh]);

    const run = async (operation) => {
        setBusy(true);
        setError('');
        try { await operation(); } catch (error) { setError(errorText(error)); }
        finally { setBusy(false); }
    };

    const download = () => run(async () => {
        const records = unwrap(await api.get('/gift-cards/admin/reconciliation'));
        const contents = JSON.stringify(records, null, 2);
        const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'gift-card-reconciliation.json';
        link.click();
        URL.revokeObjectURL(url);
    });

    const open = (type, row) => {
        setReason('');
        setEmail('');
        setAction({ type, row });
    };

    const submitAction = (event) => {
        event.preventDefault();
        run(async () => {
            const { type, row } = action;
            await api.post(`/gift-cards/admin/${type}`, {
                id: type === 'suspension' ? row.card_id : row.id,
                reason,
                ...(type === 'suspension' ? { suspended: !row.suspended } : {}),
                ...(type === 'delivery' && email ? { recipientEmail: email } : {}),
            });
            setAction(null);
            await refresh(filter.trim());
        });
    };

    const submitIssuance = (event) => {
        event.preventDefault();
        run(async () => {
            const result = unwrap(await api.post('/gift-cards/admin/issue', { ...issuance, amount: Number(issuance.amount) }));
            setIssuance(null);
            setIssuedId(result.id);
            setFilter('');
            await refresh();
        });
    };

    return (
        <Stack spacing={3}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
                <Typography variant="h4" component="h1">Digital gift cards</Typography>
                {canIssue && <Button variant="contained" disabled={busy || !policy?.issuanceAvailable} onClick={() => {
                    setError('');
                    setIssuance({ id: crypto.randomUUID(), amount: '', recipientEmail: '', message: '', reason: '' });
                }}>Create gift card</Button>}
            </Stack>
            {issuedId && <Alert severity="success" onClose={() => setIssuedId(null)}>Gift card created and queued for email. Reference {issuedId}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            {policy && !policy.issuanceAvailable && <Alert severity="info">New gift card purchases and staff issuance are paused in Platform Features.</Alert>}
            {policy && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack component="form" spacing={2} onSubmit={(event) => {
                        event.preventDefault();
                        run(async () => {
                            await api.put('/gift-cards/admin/policy', {
                                enabled: policy.enabled, minimum: Number(policy.minimum), maximum: Number(policy.maximum),
                                validityDays: policy.validity_days ? Number(policy.validity_days) : null,
                            });
                            await refresh(filter.trim());
                        });
                    }}>
                        <FormControlLabel label="Enable new gift card sales" control={<Checkbox disabled={!canManage} checked={policy.enabled}
                            onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} />} />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            {[
                                ['minimum', 'Minimum ₹', 1000000], ['maximum', 'Maximum ₹', 1000000], ['validity_days', 'Validity in days', 36500],
                            ].map(([key, label, max]) => (
                                <TextField key={key} label={label} type="number" value={policy[key] ?? ''}
                                    disabled={!canManage} required={key !== 'validity_days'} inputProps={{ min: 1, max, step: 1 }}
                                    helperText={key === 'validity_days' ? 'Leave blank for no expiry' : undefined}
                                    onChange={(event) => setPolicy({ ...policy, [key]: event.target.value })} />
                            ))}
                        </Stack>
                        <Button type="submit" variant="contained" disabled={busy || !canManage} sx={{ alignSelf: 'start' }}>Save policy</Button>
                    </Stack>
                </Paper>
            )}
            {health && (
                <Typography variant="body2">
                    {health.missing_issuance} missing issuance · {health.overdue_delivery} overdue deliveries · {health.delivery_review} delivery reviews
                    {' · '}{health.refund_review} refund reviews · {health.ledger_discrepancies} ledger discrepancies
                </Typography>
            )}
            <Stack component="form" onSubmit={(event) => { event.preventDefault(); run(() => refresh(filter.trim())); }}
                direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField size="small" label="Search by purchase reference or code suffix" value={filter}
                    onChange={(event) => setFilter(event.target.value)} fullWidth />
                <Button type="submit" variant="contained" disabled={busy || loading} sx={{ flexShrink: 0 }}>Search</Button>
                <Button variant="outlined" onClick={download} disabled={busy || loading} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Export reconciliation</Button>
            </Stack>
            <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead><TableRow>
                        {['Reference', 'Card', 'Face value', 'Balance', 'Held', 'Delivery', 'Refund', 'Actions'].map((label) => <TableCell key={label}>{label}</TableCell>)}
                    </TableRow></TableHead>
                    <TableBody>
                        {rows.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                            {loading ? 'Loading gift cards…' : error ? 'Gift cards could not be loaded.' : 'No gift cards found. Try another search or wait for the first purchase.'}
                        </TableCell></TableRow>}
                        {rows.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        {row.id}
                                        {row.issued_manually && <Typography variant="caption" display="block">Issued by staff</Typography>}
                                    </TableCell>
                                    <TableCell>{row.suffix ? `•••• ${row.suffix}${row.suspended ? ' · Suspended' : ''}` : '—'}</TableCell>
                                    <TableCell>{money(row.amount)}</TableCell>
                                    <TableCell>{money(row.balance)}</TableCell>
                                    <TableCell>{money(row.held)}</TableCell>
                                    <TableCell>
                                        {row.delivery_status || (row.captured_at ? 'Awaiting issuance' : 'Awaiting payment')}
                                        {row.sent_at && <Typography variant="caption" display="block">{date(row.sent_at)}</Typography>}
                                    </TableCell>
                                    <TableCell>{row.refund_status || '—'} {row.provider_refund}</TableCell>
                                    <TableCell>
                                        {row.card_id && (
                                            <Stack direction="row">
                                                <Button disabled={busy} onClick={() => run(async () => setLedger(unwrap(await api.get(`/gift-cards/admin/card/${row.card_id}`))))}>Ledger</Button>
                                                {canManage && <Button disabled={busy} onClick={() => open('delivery', row)}>Delivery</Button>}
                                                {canManage && <Button disabled={busy} onClick={() => open('suspension', row)}>{row.suspended ? 'Resume' : 'Suspend'}</Button>}
                                                {canRefund && !row.issued_manually && <Button disabled={busy || !!row.held || row.balance !== row.amount} onClick={() => open('refund', row)}>Refund</Button>}
                                            </Stack>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </Paper>
            <Dialog open={!!issuance && canIssue} onClose={() => !busy && setIssuance(null)} fullWidth maxWidth="sm">
                {issuance && (
                    <form onSubmit={submitIssuance}>
                        <DialogTitle>Create gift card</DialogTitle>
                        <DialogContent>
                            <Stack spacing={2} sx={{ pt: 1 }}>
                                <Typography variant="body2">The store will email the code to the recipient. No payment is collected.</Typography>
                                {error && <Alert severity="error">{error}</Alert>}
                                <TextField label="Amount in ₹" type="number" required value={issuance.amount}
                                    inputProps={{ min: policy?.minimum, max: policy?.maximum, step: 1 }}
                                    onChange={(event) => setIssuance({ ...issuance, amount: event.target.value })} />
                                <TextField label="Recipient email" type="email" required value={issuance.recipientEmail}
                                    onChange={(event) => setIssuance({ ...issuance, recipientEmail: event.target.value })} />
                                <TextField label="Message to recipient" multiline inputProps={{ maxLength: 500 }} value={issuance.message}
                                    onChange={(event) => setIssuance({ ...issuance, message: event.target.value })} />
                                <TextField label="Internal reason" required inputProps={{ minLength: 3, maxLength: 250 }} value={issuance.reason}
                                    onChange={(event) => setIssuance({ ...issuance, reason: event.target.value })} />
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setIssuance(null)} disabled={busy}>Cancel</Button>
                            <Button type="submit" variant="contained" disabled={busy}>Create and email</Button>
                        </DialogActions>
                    </form>
                )}
            </Dialog>
            <Dialog open={!!ledger} onClose={() => setLedger(null)} fullWidth>
                <DialogTitle>Card ledger</DialogTitle>
                <DialogContent>
                    {ledger?.map((entry) => <Typography key={`${entry.kind}-${entry.reference}`} variant="body2" sx={{ my: 1 }}>
                        {new Date(entry.created_at).toLocaleString()} · {entry.kind} · {money(entry.balance_delta)} · Held {money(entry.hold_delta)}
                        {entry.actor_id ? ` · Staff ${entry.actor_id}` : ''}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                    </Typography>)}
                </DialogContent>
                <DialogActions><Button onClick={() => setLedger(null)}>Close</Button></DialogActions>
            </Dialog>
            <Dialog open={!!action} onClose={() => !busy && setAction(null)} fullWidth>
                <form onSubmit={submitAction}>
                    <DialogTitle>{{ delivery: 'Resend or correct delivery', suspension: 'Change card suspension', refund: 'Refund gift card purchase' }[action?.type]}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            {error && <Alert severity="error">{error}</Alert>}
                            {action?.type === 'delivery' && (
                                <>
                                    <Typography variant="body2">
                                        {action.row.delivery_attempts ?? 0} attempts · Scheduled {date(action.row.due_at)} · Last sent {date(action.row.sent_at)}
                                    </Typography>
                                    <TextField label="New recipient email" type="email" value={email}
                                        onChange={(event) => setEmail(event.target.value)} helperText="Leave blank to resend to the current address" />
                                </>
                            )}
                            {action?.type === 'refund' && <Typography>The card will be disabled before the refund is submitted.</Typography>}
                            <TextField label="Reason" required value={reason} inputProps={{ minLength: 3, maxLength: 250 }}
                                onChange={(event) => setReason(event.target.value)} />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setAction(null)} disabled={busy}>Cancel</Button>
                        <Button type="submit" disabled={busy}>Confirm</Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Stack>
    );
}
