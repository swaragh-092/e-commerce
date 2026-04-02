import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, Button, Grid, Paper, FormControl, InputLabel, Select, MenuItem, FormHelperText, Chip, OutlinedInput } from '@mui/material';
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
        images: []
    });

    const [categories, setCategories] = useState([]);
    
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
                        images: p.images || []
                    });
                }
            }
        };
        load();
    }, [id, isNew]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                price: parseFloat(formData.price),
                salePrice: formData.salePrice ? parseFloat(formData.salePrice) : null,
                quantity: parseInt(formData.quantity) || 0
            };
            if (isNew) {
                await createProduct(payload);
            } else {
                await updateProduct(id, payload);
            }
            navigate('/admin/products');
        } catch (err) {
            alert(err.response?.data?.error?.message || err.message);
        }
    };

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
                
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button onClick={() => navigate('/admin/products')}>Cancel</Button>
                    <Button variant="contained" type="submit" size="large">Save Product</Button>
                </Box>
            </form>
        </Box>
    );
};

export default ProductEditPage;
