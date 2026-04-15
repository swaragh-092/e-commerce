import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import {
    findMatchingVariant,
    getVariantAttributeGroups,
    getVariantOptionEntries,
} from '../../utils/variantOptions';

const VariantSelector = ({ variants, selectedVariantId, onSelect }) => {
    const activeVariants = useMemo(
        () => (Array.isArray(variants) ? variants.filter((variant) => variant?.isActive !== false) : []),
        [variants]
    );
    const [selections, setSelections] = useState({});

    useEffect(() => {
        if (!selectedVariantId || activeVariants.length === 0) {
            return;
        }

        const selectedVariant = activeVariants.find((variant) => variant.id === selectedVariantId);
        if (!selectedVariant) {
            return;
        }

        const nextSelections = getVariantOptionEntries(selectedVariant).reduce((accumulator, entry) => {
            accumulator[entry.attributeId] = entry.valueId;
            return accumulator;
        }, {});

        setSelections((currentSelections) => {
            const currentKey = JSON.stringify(currentSelections);
            const nextKey = JSON.stringify(nextSelections);
            return currentKey === nextKey ? currentSelections : nextSelections;
        });
    }, [selectedVariantId, activeVariants]);

    if (activeVariants.length === 0) return null;

    const groups = getVariantAttributeGroups(activeVariants);

    const handleSelect = (attributeId, valueId) => {
        const nextSelections = { ...selections, [attributeId]: valueId };
        setSelections(nextSelections);
        const matchedVariant = findMatchingVariant(activeVariants, nextSelections);
        if (matchedVariant) {
            onSelect(matchedVariant);
        }
    };

    const unselectedGroups = groups.filter((group) => !selections[group.attributeId]);
    const allGroupsSelected = unselectedGroups.length === 0;

    return (
        <Box sx={{ my: 3 }}>
            {groups.map((group) => (
                <Box key={group.attributeId} sx={{ mb: 2.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {group.attributeName}
                        {selections[group.attributeId] && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 'normal' }}>
                                - {group.values.find((value) => value.valueId === selections[group.attributeId])?.valueLabel}
                            </Typography>
                        )}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {group.values.map((value) => {
                            const isSelected = selections[group.attributeId] === value.valueId;
                            const hasMatchingVariant = activeVariants.some((variant) => {
                                const variantEntries = getVariantOptionEntries(variant);
                                const includesCurrentValue = variantEntries.some((entry) => (
                                    entry.attributeId === group.attributeId && entry.valueId === value.valueId
                                ));
                                if (!includesCurrentValue) {
                                    return false;
                                }

                                return Object.entries(selections)
                                    .filter(([attributeId]) => attributeId !== group.attributeId)
                                    .every(([attributeId, valueId]) => (
                                        !valueId || variantEntries.some((entry) => entry.attributeId === attributeId && entry.valueId === valueId)
                                    ));
                            });

                            return (
                                <Button
                                    key={value.valueId}
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    disabled={!hasMatchingVariant}
                                    onClick={() => handleSelect(group.attributeId, value.valueId)}
                                    sx={{ minWidth: 72 }}
                                >
                                    {value.valueLabel}
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
            ))}

            {groups.length > 1 && !allGroupsSelected && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                    <Typography variant="caption" color="warning.main">
                        Please also select:
                    </Typography>
                    {unselectedGroups.map((group) => (
                        <Chip key={group.attributeId} label={group.attributeName} size="small" variant="outlined" color="warning" />
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default VariantSelector;
