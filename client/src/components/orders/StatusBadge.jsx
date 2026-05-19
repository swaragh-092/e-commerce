import React from 'react';
import { Box, Typography } from '@mui/material';
import { STATUS_CONFIG } from '../../pages/storefront/AllOrdersPage/constants';
import { getCustomerOrderDisplayStatus, getCustomerOrderStatusLabel } from '../../utils/orderHelpers';

const StatusBadge = React.memo(({ status, order }) => {
    const displayStatus = order ? getCustomerOrderDisplayStatus(order) : status;
    const cfg = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.placed;
    const Icon = cfg.icon;
    const label = getCustomerOrderStatusLabel(displayStatus);

    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.25,
                py: 0.4,
                borderRadius: '4px',
                border: `1px solid ${cfg.border}`,
                bgcolor: cfg.bg,
            }}
        >
            <Icon sx={{ fontSize: 11, color: cfg.color }} />
            <Typography
                sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    color: cfg.color,
                    textTransform: 'uppercase',
                    lineHeight: 1,
                }}
            >
                {label}
            </Typography>
        </Box>
    );
});

export default StatusBadge;
