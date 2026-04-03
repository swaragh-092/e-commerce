import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box, Typography, TextField, Button, Grid, Paper,
    FormControl, InputLabel, Select, MenuItem, Chip,
    OutlinedInput, Alert, IconButton, Divider, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { getProduct, createProduct, updateProduct } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import MediaUploader from '../../components/common/MediaUploader';

const ProductEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';

    const [formData, setFormData] = useState({
        name: '', description: '', shortDescription: '', sku: '',
        price: '', salePrice: '', quantity: '', status: 'draft',
        categoryIds: [],
        images: [],
        variants: [],
    });

    const [categories, setCategories] = useState([]);
    const [saveError, setSaveError] = useState(null);
    
    useEffect(() => {
        const load = async () => {
            const catRes = await getCategoryTree();
            setCategories(catRes?.data?.categories || []);

            if (!isNew) {
                // Fetch product by id or slug
                const prodRes = await getProduct(id);
                if (prodRes?.data?.product) {
                    const p = prodRes.data.product;
                    setFormData({
                        name: p.name, description: p.description || '', shortDescription: p.shortDescription || '',
                        sku: p.sku || '', price: p.price, salePrice: p.salePrice || '', quantity: p.quantity,
                        status: p.status, categoryIds: p.categories?.map(c => c.id) || [],
                        images: p.images || [],
                        variants: (p.ProductVariants || p.variants || []).map(v => ({
                            id: v.id,
                            name: v.name || '',
                            value: v.value || '',
                            priceModifier: v.priceModifier ?? 0,
                            quantity: v.quantity ?? 0,
                            sku: v.sku || '',
                        })),
                    });
                }
            }
        };
        load();
    }, [id, isNew]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaveError(null);
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
                quantity: parseInt(formData.quantity) || 0,
                variants: formData.variants.map(v => ({
                    ...v,
                    priceModifier: parseFloat(v.priceModifier) || 0,
                    quantity: parseInt(v.quantity) || 0,
                })),
            };
            if (isNew) {
                await createProduct(payload);
            } else {
                await updateProduct(id, payload);
            }
            navigate('/admin/products');
        } catch (err) {
            setSaveError(err.response?.data?.error?.message || err.message || 'Failed to save product.');
        }
    };

    /* ── Variant helpers ── */
    const addVariant = () =>
        setFormData(prev => ({
            ...prev,
            variants: [...prev.variants, { name: '', value: '', priceModifier: 0, quantity: 0, sku: '' }],
        }));

    const removeVariant = (idx) =>
        setFormData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }));

    const setVariantField = (idx, field, value) =>
        setFormData(prev => ({
            ...prev,
            variants: prev.variants.map((v, i) => i === idx ? { ...v, [field]: value } : v),
        }));

    const handleMediaUpload = (media) => {
        setFormData(prev => ({
            ...prev,
            images: [...prev.images, { url: media.url, mediaId: media.id, alt: 'Product Image', isPrimary: prev.images.length === 0 }]
        }));
    };

    // Flatten logic for multiselect
    const flatCatFiles = [];
    const flatten = (arr) => {
        arr.forEach(c => {
            flatCatFiles.push(c);
            if (c.children?.length) flatten(c.children);
        });
    };
    flatten(categories);

    return (
        <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
            <Typography variant="h4" gutterBottom>{isNew ? 'Create Product' : 'Edit Product'}</Typography>
            <form onSubmit={handleSave}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>Basic Info</Typography>
                            <TextField fullWidth label="Product Name" margin="normal" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            <TextField fullWidth label="Short Description" margin="normal" value={formData.shortDescription} onChange={e => setFormData({...formData, shortDescription: e.target.value})} />
                            <TextField fullWidth label="Full Description" margin="normal" multiline rows={6} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            <Typography variant="caption" color="text.secondary">Supports HTML formatting</Typography>
                        </Paper>

                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>Pricing</Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <TextField fullWidth label="Price" type="number" required inputProps={{ step: "0.01" }} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField fullWidth label="Sale Price" type="number" inputProps={{ step: "0.01" }} value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} />
                                </Grid>
                            </Grid>
                        </Paper>
                        
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h6" gutterBottom>Media / Images</Typography>
                            <MediaUploader onUploadSuccess={handleMediaUpload} />
                            
                            {formData.images.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                                    {formData.images.map((img, idx) => (
                                        <Box key={idx} sx={{ position: 'relative', width: 100, height: 100 }}>
                                            <img src={img.url} alt="img" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>Status</Typography>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Status</InputLabel>
                                <Select value={formData.status} label="Status" onChange={e => setFormData({...formData, status: e.target.value})}>
                                    <MenuItem value="draft">Draft</MenuItem>
                                    <MenuItem value="published">Published</MenuItem>
                                </Select>
                            </FormControl>
                        </Paper>

                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>Organization</Typography>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Categories</InputLabel>
                                <Select
                                    multiple
                                    value={formData.categoryIds}
                                    onChange={e => setFormData({...formData, categoryIds: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value})}
                                    input={<OutlinedInput label="Categories" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => {
                                                const cat = flatCatFiles.find(c => c.id === value);
                                                return <Chip key={value} label={cat?.name || value} size="small" />;
                                            })}
                                        </Box>
                                    )}
                                >
                                    {flatCatFiles.map((c) => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Paper>

                        <Paper sx={{ p: 3, mb: 3 }}>
                            <Typography variant="h6" gutterBottom>Inventory</Typography>
                            <TextField fullWidth label="SKU" margin="normal" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} />
                            <TextField fullWidth label="Stock Quantity" type="number" margin="normal" required value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                        </Paper>

                    </Grid>
                </Grid>

                {/* Variants */}
                <Paper sx={{ p: 3, mt: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Product Variants</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={addVariant} variant="outlined">
                            Add Variant
                        </Button>
                    </Box>

                    {formData.variants.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                            No variants — product uses the base price and stock quantity above.
                        </Typography>
                    ) : (
                        formData.variants.map((v, idx) => (
                            <Box key={idx}>
                                {idx > 0 && <Divider sx={{ my: 2 }} />}
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} sm={2}>
                                        <TextField
                                            fullWidth size="small" label="Attribute"
                                            placeholder="e.g. Color"
                                            value={v.name}
                                            onChange={(e) => setVariantField(idx, 'name', e.target.value)}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={2}>
                                        <TextField
                                            fullWidth size="small" label="Value"
                                            placeholder="e.g. Red"
                                            value={v.value}
                                            onChange={(e) => setVariantField(idx, 'value', e.target.value)}
                                        />
                                    </Grid>
                                    <Grid item xs={6} sm={2}>
                                        <TextField
                                            fullWidth size="small" label="Price Modifier"
                                            type="number" inputProps={{ step: '0.01' }}
                                            value={v.priceModifier}
                                            onChange={(e) => setVariantField(idx, 'priceModifier', e.target.value)}
                                            helperText="+/- from base"
                                        />
                                    </Grid>
                                    <Grid item xs={6} sm={2}>
                                        <TextField
                                            fullWidth size="small" label="Stock"
                                            type="number"
                                            value={v.quantity}
                                            onChange={(e) => setVariantField(idx, 'quantity', e.target.value)}
                                        />
                                    </Grid>
                                    <Grid item xs={10} sm={3}>
                                        <TextField
                                            fullWidth size="small" label="SKU (optional)"
                                            value={v.sku}
                                            onChange={(e) => setVariantField(idx, 'sku', e.target.value)}
                                        />
                                    </Grid>
                                    <Grid item xs={2} sm={1}>
                                        <Tooltip title="Remove variant">
                                            <IconButton color="error" size="small" onClick={() => removeVariant(idx)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Grid>
                                </Grid>
                            </Box>
                        ))
                    )}
                </Paper>

                {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button onClick={() => navigate('/admin/products')}>Cancel</Button>
                    <Button variant="contained" type="submit" size="large">Save Product</Button>
                </Box>
            </form>
        </Box>
    );
};

export default ProductEditPage;
