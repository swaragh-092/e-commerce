import {
    CheckCircle as CheckCircleIcon,
    LocalShipping as ShippingIcon,
    Cancel as CancelIcon,
    HourglassEmpty as ProcessingIcon,
    Inventory2 as PlacedIcon,
    Done as ConfirmedIcon,
} from '@mui/icons-material';

// ─── Constants ───────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
    { value: 'placed',     label: 'Placed' },
    { value: 'confirmed',  label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped',    label: 'On the way' },
    { value: 'delivered',  label: 'Delivered' },
    { value: 'cancelled',  label: 'Cancelled' },
];

export const TIME_FILTERS = [
    { value: '30',    label: 'Last 30 days' },
    { value: '2024',  label: '2024' },
    { value: '2023',  label: '2023' },
    { value: 'older', label: 'Older' },
];

export const LIMIT = 10;

// ─── Status config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
    placed:     { icon: PlacedIcon,      bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    confirmed:  { icon: ConfirmedIcon,   bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    processing: { icon: ProcessingIcon,  bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    shipped:    { icon: ShippingIcon,    bg: '#F5F3FF', color: '#6D28D9', border: '#DDD6FE' },
    delivered:  { icon: CheckCircleIcon, bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    cancelled:  { icon: CancelIcon,      bg: '#FFF1F2', color: '#BE123C', border: '#FECDD3' },
};
