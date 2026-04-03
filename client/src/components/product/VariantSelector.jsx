import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';

const VariantSelector = ({ variants, selectedVariantId, onSelect }) => {
    // Per-group selection map: { [attrName]: variantId }
    const [selections, setSelections] = useState({});

    if (!variants || variants.length === 0) return null;

    const grouped = variants.reduce((acc, curr) => {
        if (!acc[curr.name]) acc[curr.name] = [];
        acc[curr.name].push(curr);
        return acc;
    }, {});

    const groupNames = Object.keys(grouped);
    const isMultiGroup = groupNames.length > 1;

    // Sync external selectedVariantId into per-group selections
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (selectedVariantId) {
            const v = variants.find(v => v.id === selectedVariantId);
            if (v) {
                setSelections(prev => {
                    // Only update if this group's selection actually changed
                    if (prev[v.name] === v.id) return prev;
                    return { ...prev, [v.name]: v.id };
                });
            }
        }
    }, [selectedVariantId, variants]);

    const handleSelect = (opt) => {
        setSelections(prev => ({ ...prev, [opt.name]: opt.id }));
        onSelect(opt); // backward-compat: parent receives the last-clicked variant
    };

    const unselectedGroups = groupNames.filter(g => !selections[g]);
    const allGroupsSelected = unselectedGroups.length === 0;

    return (
        <Box sx={{ my: 3 }}>
            {Object.entries(grouped).map(([attrName, options]) => {
                const selectedId = selections[attrName];
                return (
                    <Box key={attrName} sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                            {attrName}
                            {selectedId && (
                                <Typography
                                    component="span"
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ ml: 1, fontWeight: 'normal' }}
                                >
                                    — {options.find(o => o.id === selectedId)?.value}
                                </Typography>
                            )}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {options.map(opt => {
                                const isSelected = selectedId === opt.id;
                                const isOutOfStock = opt.quantity <= 0;
                                return (
                                    <Button
                                        key={opt.id}
                                        variant={isSelected ? 'contained' : 'outlined'}
                                        disabled={isOutOfStock}
                                        onClick={() => handleSelect(opt)}
                                        sx={{
                                            minWidth: 60,
                                            position: 'relative',
                                            ...(isOutOfStock && {
                                                textDecoration: 'line-through',
                                                opacity: 0.5,
                                            }),
                                        }}
                                    >
                                        {opt.value}
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>
                );
            })}

            {/* Cross-group validation reminder */}
            {isMultiGroup && !allGroupsSelected && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    <Typography variant="caption" color="warning.main">
                        Please also select:
                    </Typography>
                    {unselectedGroups.map(g => (
                        <Chip key={g} label={g} size="small" variant="outlined" color="warning" />
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default VariantSelector;

