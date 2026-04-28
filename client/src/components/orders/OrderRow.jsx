import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { KeyboardArrowRight as ArrowIcon } from '@mui/icons-material';
import StatusBadge from './StatusBadge';
import { getProductSummary, formatOrderDate } from '../../utils/orderHelpers';

const OrderRow = ({ order, onView, formatPrice }) => {
    const { summary, qty } = getProductSummary(order);

    const date = formatOrderDate(
        order.status === 'delivered' ? (order.deliveredAt || order.updatedAt) : order.createdAt
    );

    const paymentLabel = order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online';

    return (
        <Box
            onClick={() => onView(order.id)}
            sx={{
                borderBottom: '1px solid',
                borderColor: 'divider',
                py: 2.5,
                px: { xs: 2, md: 3 },
                cursor: 'pointer',
                transition: 'background 0.12s',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.018)' },
                '&:last-child': { borderBottom: 'none' },
            }}
        >
            {/* Row 1 — meta bar */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                            color: 'text.disabled',
                        }}
                    >
                        {date}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: 11,
                            letterSpacing: 0.3,
                            color: 'text.disabled',
                            fontFamily: 'monospace',
                        }}
                    >
                        #{order.orderNumber || order.id?.slice(0, 8).toUpperCase()}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                        {paymentLabel}
                    </Typography>
                </Box>
                <StatusBadge status={order.status} />
            </Box>

            {/* Row 2 — products */}
            <Typography
                sx={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: { xs: '100%', sm: '70%', md: '75%' },
                }}
                title={summary}
            >
                {summary}
            </Typography>

            {/* Row 3 — price + qty + action */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                        {formatPrice(order.total || 0)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {qty} item{qty !== 1 ? 's' : ''}
                    </Typography>
                </Box>

                <Button
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={(e) => { e.stopPropagation(); onView(order.id); }}
                    sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                        borderRadius: '4px',
                        borderColor: 'divider',
                        color: 'text.primary',
                        px: 1.5,
                        py: 0.5,
                        minWidth: 'auto',
                        textTransform: 'none',
                        '&:hover': {
                            borderColor: 'text.primary',
                            bgcolor: 'transparent',
                        },
                    }}
                >
                    View Details
                </Button>
            </Box>
        </Box>
    );
};

export default OrderRow;
