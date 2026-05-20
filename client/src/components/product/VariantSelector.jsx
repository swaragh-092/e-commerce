import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Tooltip,
    FormControlLabel,
} from '@mui/material';
import {
    findMatchingVariant,
    getVariantAttributeGroups,
    getVariantOptionEntries,
} from '../../utils/variantOptions';
import {
    formatAttributeValue,
    getAttributeValueA11yLabel,
    getSwatchColor,
    resolveAttributePresentation,
} from '../../utils/attributePresentation';

const isVariantAvailable = (variant) => {
    const stock = Number(variant?.stockQty || 0);
    const reserved = Number(variant?.reservedQty || 0);
    return variant?.isActive !== false && (stock - reserved) > 0;
};

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

    const hasMatchingVariant = (group, valueId) => activeVariants.some((variant) => {
        if (!isVariantAvailable(variant)) return false;

        const variantEntries = getVariantOptionEntries(variant);
        const includesCurrentValue = variantEntries.some((entry) => (
            entry.attributeId === group.attributeId && entry.valueId === valueId
        ));
        if (!includesCurrentValue) {
            return false;
        }

        return Object.entries(selections)
            .filter(([attributeId]) => attributeId !== group.attributeId)
            .every(([attributeId, selectedValueId]) => (
                !selectedValueId || variantEntries.some((entry) => entry.attributeId === attributeId && entry.valueId === selectedValueId)
            ));
    });

    const handleSelect = (attributeId, valueId) => {
        const nextSelections = { ...selections, [attributeId]: valueId };
        setSelections(nextSelections);
        const matchedVariant = findMatchingVariant(activeVariants, nextSelections);
        if (matchedVariant && isVariantAvailable(matchedVariant)) {
            onSelect(matchedVariant);
        }
    };

    const unselectedGroups = groups.filter((group) => !selections[group.attributeId]);
    const allGroupsSelected = unselectedGroups.length === 0;

    const renderOption = (group, value) => {
        const isSelected = selections[group.attributeId] === value.valueId;
        const isAvailable = hasMatchingVariant(group, value.valueId);
        const label = formatAttributeValue(value, group.attribute);
        const swatchColor = getSwatchColor(value);
        const { displayType } = resolveAttributePresentation(group);
        const commonA11y = getAttributeValueA11yLabel(group, value, isSelected, !isAvailable);

        if (displayType === 'swatch' || displayType === 'image') {
            const content = (
                <Button
                    key={value.valueId}
                    disabled={!isAvailable}
                    onClick={() => handleSelect(group.attributeId, value.valueId)}
                    aria-label={commonA11y}
                    aria-pressed={isSelected}
                    sx={{
                        minWidth: 0,
                        width: 54,
                        height: 54,
                        p: 0.5,
                        borderRadius: '50%',
                        border: '2px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: 'background.paper',
                        boxShadow: isSelected ? '0 0 0 3px rgba(108, 99, 255, 0.18)' : 'none',
                        opacity: isAvailable ? 1 : 0.38,
                        '&:hover': {
                            borderColor: isAvailable ? 'primary.main' : 'divider',
                            bgcolor: 'background.paper',
                        },
                    }}
                >
                    <Box
                        sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            border: '1px solid',
                            borderColor: swatchColor === '#ffffff' ? 'divider' : 'transparent',
                            bgcolor: value.imageUrl ? 'transparent' : (swatchColor || 'action.hover'),
                            backgroundImage: value.imageUrl ? `url(${value.imageUrl})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    />
                </Button>
            );

            return (
                <Tooltip key={value.valueId} title={label || value.valueLabel} arrow>
                    <span>{content}</span>
                </Tooltip>
            );
        }

        if (displayType === 'chip') {
            return (
                <Chip
                    key={value.valueId}
                    label={label}
                    clickable={isAvailable}
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={isAvailable ? () => handleSelect(group.attributeId, value.valueId) : undefined}
                    aria-label={commonA11y}
                    sx={{
                        height: 38,
                        px: 0.5,
                        fontWeight: 700,
                        opacity: isAvailable ? 1 : 0.42,
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                />
            );
        }

        return (
            <Button
                key={value.valueId}
                variant={isSelected ? 'contained' : 'outlined'}
                disabled={!isAvailable}
                onClick={() => handleSelect(group.attributeId, value.valueId)}
                aria-label={commonA11y}
                aria-pressed={isSelected}
                sx={{
                    minWidth: 64,
                    height: 42,
                    px: 1.75,
                    borderRadius: 1.5,
                    fontWeight: 800,
                    textTransform: 'none',
                }}
            >
                {label}
            </Button>
        );
    };

    return (
        <Box sx={{ my: 3 }}>
            {groups.map((group) => {
                const { displayType, valueType } = resolveAttributePresentation(group);
                const selectedLabel = group.values.find((value) => value.valueId === selections[group.attributeId]);

                return (
                <Box key={group.attributeId} sx={{ mb: 2.75 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {group.attributeName}
                        {selections[group.attributeId] && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 'normal' }}>
                                - {selectedLabel ? formatAttributeValue(selectedLabel, group.attribute) : ''}
                            </Typography>
                        )}
                    </Typography>
                    {displayType === 'dropdown' ? (
                        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 260 } }}>
                            <InputLabel>{group.attributeName}</InputLabel>
                            <Select
                                label={group.attributeName}
                                value={selections[group.attributeId] || ''}
                                onChange={(event) => handleSelect(group.attributeId, event.target.value)}
                            >
                                {group.values.map((value) => {
                                    const label = formatAttributeValue(value, group.attribute);
                                    return (
                                        <MenuItem
                                            key={value.valueId}
                                            value={value.valueId}
                                            disabled={!hasMatchingVariant(group, value.valueId)}
                                        >
                                            {label}
                                        </MenuItem>
                                    );
                                })}
                            </Select>
                        </FormControl>
                    ) : displayType === 'radio' ? (
                        <RadioGroup
                            row
                            aria-label={group.attributeName}
                            value={selections[group.attributeId] || ''}
                            onChange={(event) => handleSelect(group.attributeId, event.target.value)}
                            sx={{ gap: 1 }}
                        >
                            {group.values.map((value) => {
                                const label = formatAttributeValue(value, group.attribute);
                                const isAvailable = hasMatchingVariant(group, value.valueId);
                                return (
                                    <FormControlLabel
                                        key={value.valueId}
                                        value={value.valueId}
                                        disabled={!isAvailable}
                                        control={<Radio size="small" />}
                                        label={label}
                                        sx={{
                                            px: 1,
                                            border: '1px solid',
                                            borderColor: selections[group.attributeId] === value.valueId ? 'primary.main' : 'divider',
                                            borderRadius: 1.5,
                                            mr: 0,
                                        }}
                                    />
                                );
                            })}
                        </RadioGroup>
                    ) : (
                        <Box
                            role="radiogroup"
                            aria-label={group.attributeName}
                            sx={{
                                display: 'flex',
                                gap: displayType === 'swatch' || displayType === 'image' ? 1.25 : 1,
                                flexWrap: 'wrap',
                                alignItems: 'center',
                            }}
                        >
                            {group.values.map((value) => renderOption({ ...group, presentationType: displayType, valueType }, value))}
                        </Box>
                    )}
                </Box>
                );
            })}

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
