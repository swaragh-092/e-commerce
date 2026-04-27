import React from 'react';
import { Box, Skeleton } from '@mui/material';

const OrderSkeleton = () => (
    <Box
        sx={{
            borderBottom: '1px solid',
            borderColor: 'divider',
            py: 2.5,
            px: { xs: 2, md: 3 },
        }}
    >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Skeleton width={120} height={14} />
            <Skeleton width={80} height={22} sx={{ borderRadius: 1 }} />
        </Box>
        <Skeleton width="55%" height={18} sx={{ mb: 0.75 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={90} height={30} sx={{ borderRadius: 1 }} />
        </Box>
    </Box>
);

export default OrderSkeleton;
