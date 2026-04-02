import React from 'react';
import { Box, Typography, Button } from '@mui/material';

const VariantSelector = ({ variants, selectedVariantId, onSelect }) => {
    if (!variants || variants.length === 0) return null;

    const grouped = variants.reduce((acc, curr) => {
        if (!acc[curr.name]) acc[curr.name] = [];
        acc[curr.name].push(curr);
        return acc;
    }, {});

    return (
        <Box sx={{ my: 3 }}>
            {Object.entries(grouped).map(([attrName, options]) => (
                <Box key={attrName} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {attrName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {options.map(opt => {
                            const isSelected = selectedVariantId === opt.id;
                            const isOutOfStock = opt.quantity <= 0;
                            return (
                                <Button
                                    key={opt.id}
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    disabled={isOutOfStock}
                                    onClick={() => onSelect(opt)}
                                    sx={{ minWidth: 60 }}
                                >
                                    {opt.value}
                                </Button>
                            );
                        })}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default VariantSelector;
