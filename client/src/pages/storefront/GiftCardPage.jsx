import { useEffect, useState } from 'react';
import { Alert, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import api from '../../services/api';
import loadScript from '../../utils/loadPaymentScript';

const storageKey = 'digitalGiftCardPurchase';
const unwrap = ({ data }) => data.data;
const errorMessage = (error) => error.response?.data?.error?.message || error.message;
const initialForm = { amount: '', buyerEmail: '', recipientEmail: '', senderName: '', message: '', deliveryDate: '' };
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function GiftCardPage() {
    const [policy, setPolicy] = useState(null);
    const [form, setForm] = useState(initialForm);
    const [purchase, setPurchase] = useState(() => {
        const shared = window.location.hash.match(/^#([0-9a-f-]{36})\/([0-9a-f]{64})$/i);
        if (shared) return { id: shared[1], token: shared[2], emailVerified: true };
        try { return JSON.parse(sessionStorage.getItem(storageKey)); } catch { return null; }
    });
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [correction, setCorrection] = useState('');
    const [review, setReview] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        api.get('/gift-cards/policy', { signal: controller.signal }).then(unwrap).then(setPolicy).catch((err) => {
            if (!controller.signal.aborted) setError(errorMessage(err));
        });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (purchase?.emailVerified && window.location.hash) {
            window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
        }
        if (!purchase) return undefined;
        const controller = new AbortController();
        let timer;
        const refresh = async () => {
            try {
                const result = unwrap(await api.post('/gift-cards/status', purchase, { signal: controller.signal }));
                if (!controller.signal.aborted) setStatus(result);
            } catch (err) {
                if (!controller.signal.aborted) setError(errorMessage(err));
            } finally {
                if (!controller.signal.aborted) timer = setTimeout(refresh, 10000);
            }
        };
        refresh();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [purchase]);

    const startPayment = async (existing = null) => {
        setBusy(true);
        setError('');
        try {
            const Razorpay = await loadScript('https://checkout.razorpay.com/v1/checkout.js', 'Razorpay');
            const order = existing
                ? unwrap(await api.post('/gift-cards/resume', existing))
                : unwrap(await api.post('/gift-cards/purchases', { ...form, amount: Number(form.amount), expectedValidityDays: policy.validity_days }));
            if (order.settled) {
                setStatus(unwrap(await api.post('/gift-cards/status', existing)));
                return;
            }
            const access = { id: order.id, token: order.token };
            try { sessionStorage.setItem(storageKey, JSON.stringify(access)); } catch { /* keep in memory */ }
            setPurchase(access);
            setStatus({ payment: 'pending' });
            new Razorpay({
                key: order.keyId,
                order_id: order.providerOrder,
                amount: order.amount,
                currency: 'INR',
                description: 'Digital gift card',
                prefill: { email: form.buyerEmail },
                handler: async ({ razorpay_payment_id: paymentId }) => {
                    try {
                        setStatus(unwrap(await api.post('/gift-cards/verify', { ...access, paymentId })));
                    } catch {
                        setError('We’re waiting for payment confirmation. Check the status before paying again.');
                    }
                },
            }).open();
        } catch (err) { setError(errorMessage(err)); }
        finally { setBusy(false); }
    };

    const update = (name) => (event) => setForm({ ...form, [name]: event.target.value });

    return (
        <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
            <Stack spacing={3}>
                <Typography variant="h3" component="h1">Digital gift card</Typography>
                {error && <Alert severity="error">{error}</Alert>}
                {purchase ? (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        <Stack spacing={2}>
                            <Typography variant="h6">Payment {status?.payment || 'pending'}</Typography>
                            <Typography variant="body2">Purchase reference {purchase.id}</Typography>
                            {status?.delivery && <Typography>Recipient email {status.delivery}</Typography>}
                            {status?.refund && <Typography>Refund {status.refund}</Typography>}
                            {!purchase.emailVerified && ['pending', 'bounced', 'failed'].includes(status?.delivery) && (
                                <Typography variant="body2">Use the link in your purchase receipt to correct the recipient email.</Typography>
                            )}
                            {purchase.emailVerified && ['pending', 'bounced', 'failed'].includes(status?.delivery) && (
                                <Stack component="form" spacing={1} onSubmit={async (event) => {
                                    event.preventDefault();
                                    try {
                                        await api.post('/gift-cards/recipient', { ...purchase, recipientEmail: correction });
                                        setStatus({ ...status, delivery: 'pending' });
                                        setCorrection('');
                                        setError('');
                                    } catch (err) { setError(errorMessage(err)); }
                                }}>
                                    <TextField label="Correct recipient email" type="email" required value={correction}
                                        onChange={(event) => setCorrection(event.target.value)} />
                                    <Button type="submit">Update recipient</Button>
                                </Stack>
                            )}
                            {['pending', 'failed'].includes(status?.payment) && (
                                <Button disabled={busy} onClick={() => startPayment(purchase)}>Resume payment</Button>
                            )}
                            {status?.payment !== 'pending' && status?.payment && <Button onClick={() => {
                                try { sessionStorage.removeItem(storageKey); } catch { /* keep in memory */ }
                                setPurchase(null);
                                setReview(false);
                            }}>Buy another gift card</Button>}
                        </Stack>
                    </Paper>
                ) : policy?.enabled ? (
                    <Paper variant="outlined" sx={{ p: 3 }}>
                        {review ? (
                            <Stack spacing={2}>
                                <Typography variant="h6">Review your gift</Typography>
                                <Typography>{inr.format(Number(form.amount))} · {form.recipientEmail}</Typography>
                                <Typography>{form.deliveryDate ? `Send on ${form.deliveryDate} from 9 a.m. IST` : 'Send by email after payment'}</Typography>
                                <Typography>{policy.validity_days ? `Valid for ${policy.validity_days} days from the delivery due date` : 'No expiry'}</Typography>
                                {form.senderName && <Typography>From {form.senderName}</Typography>}
                                {form.message && <Typography sx={{ whiteSpace: 'pre-wrap' }}>{form.message}</Typography>}
                                <Button variant="contained" onClick={() => startPayment()} disabled={busy}>Pay {inr.format(Number(form.amount))}</Button>
                                <Button onClick={() => setReview(false)} disabled={busy}>Edit gift</Button>
                            </Stack>
                        ) : (
                            <Stack component="form" spacing={2} onSubmit={(event) => { event.preventDefault(); setReview(true); }}>
                                <TextField required label="Amount in INR" type="number" value={form.amount} onChange={update('amount')}
                                    inputProps={{ min: policy.minimum, max: policy.maximum, step: 1 }} />
                                <TextField required label="Your email" type="email" value={form.buyerEmail} onChange={update('buyerEmail')} />
                                <TextField required label="Recipient email" type="email" value={form.recipientEmail} onChange={update('recipientEmail')} />
                                <TextField label="Sender name" value={form.senderName} onChange={update('senderName')} inputProps={{ maxLength: 100 }} />
                                <TextField label="Personal message" multiline minRows={3} value={form.message} onChange={update('message')} inputProps={{ maxLength: 500 }} />
                                <TextField label="Delivery date" type="date" InputLabelProps={{ shrink: true }} value={form.deliveryDate}
                                    onChange={update('deliveryDate')} helperText="Leave blank to send after payment" />
                                <Button type="submit" variant="contained">Review gift</Button>
                            </Stack>
                        )}
                    </Paper>
                ) : policy && <Alert severity="info">Gift card sales are currently paused.</Alert>}
            </Stack>
        </Container>
    );
}
