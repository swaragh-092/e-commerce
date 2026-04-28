import React from 'react';
import { Box, Typography } from '@mui/material';
import { STATUS_CONFIG } from '../../pages/storefront/AllOrdersPage/constants';
import { getOrderStatusLabel } from '../../utils/orderWorkflow';

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.placed;
    const Icon = cfg.icon;
    const label = getOrderStatusLabel(status);

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
};

export default StatusBadge;
