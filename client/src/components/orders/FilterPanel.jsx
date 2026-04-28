import React from 'react';
import {
    Box,
    Typography,
    Button,
    Stack,
    Checkbox,
    FormControlLabel,
    Divider,
} from '@mui/material';
import { ORDER_STATUSES, TIME_FILTERS } from '../../pages/storefront/AllOrdersPage/constants';

const FilterPanel = ({
    selectedStatuses,
    onStatusToggle,
    selectedTimeFilter,
    onTimeFilterChange,
    onClear,
}) => {
    const activeCount = selectedStatuses.length + (selectedTimeFilter ? 1 : 0);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Typography
                    sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                        color: 'text.primary',
                    }}
                >
                    Filters
                </Typography>
                {activeCount > 0 && (
                    <Button
                        size="small"
                        onClick={onClear}
                        sx={{
                            fontSize: 11,
                            color: 'text.secondary',
                            textTransform: 'none',
                            p: 0,
                            minWidth: 'auto',
                            textDecoration: 'underline',
                            '&:hover': { bgcolor: 'transparent', color: 'text.primary' },
                        }}
                    >
                        Clear ({activeCount})
                    </Button>
                )}
            </Box>

            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                    mb: 1,
                    display: 'block',
                }}
            >
                Order Status
            </Typography>
            <Stack spacing={0} sx={{ mb: 3 }}>
                {ORDER_STATUSES.map((s) => (
                    <FormControlLabel
                        key={s.value}
                        control={
                            <Checkbox
                                checked={selectedStatuses.includes(s.value)}
                                onChange={() => onStatusToggle(s.value)}
                                size="small"
                                sx={{
                                    p: 0.75,
                                    color: 'text.disabled',
                                    '&.Mui-checked': { color: 'text.primary' },
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
                                {s.label}
                            </Typography>
                        }
                        sx={{ mx: 0, ml: -0.5 }}
                    />
                ))}
            </Stack>

            <Divider sx={{ mb: 2.5 }} />

            <Typography
                sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    color: 'text.disabled',
                    mb: 1,
                    display: 'block',
                }}
            >
                Order Time
            </Typography>
            <Stack spacing={0}>
                {TIME_FILTERS.map((t) => (
                    <FormControlLabel
                        key={t.value}
                        control={
                            <Checkbox
                                checked={selectedTimeFilter === t.value}
                                onChange={() => onTimeFilterChange(t.value)}
                                size="small"
                                sx={{
                                    p: 0.75,
                                    color: 'text.disabled',
                                    '&.Mui-checked': { color: 'text.primary' },
                                }}
                            />
                        }
                        label={
                            <Typography sx={{ fontSize: 13, color: 'text.primary' }}>
                                {t.label}
                            </Typography>
                        }
                        sx={{ mx: 0, ml: -0.5 }}
                    />
                ))}
            </Stack>
        </Box>
    );
};

export default FilterPanel;
