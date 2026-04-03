import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  FormHelperText,
} from '@mui/material';
import {
  getProduct,
  getProductById,
  createProduct,
  updateProduct,
} from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import MediaUploader from '../../components/common/MediaUploader';
import { useNotification } from '../../context/NotificationContext';

const validate = (formData) => {
  const errs = {};
  if (!formData.name.trim()) errs.name = 'Product name is required.';
  else if (formData.name.trim().length > 255)
    errs.name = 'Product name must be 255 characters or less.';

  if (formData.price === '' || formData.price === null || formData.price === undefined) {
    errs.price = 'Price is required.';
  } else if (isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
    errs.price = 'Price must be a positive number.';
  }

  if (formData.salePrice !== '' && formData.salePrice !== null) {
    if (isNaN(Number(formData.salePrice)) || Number(formData.salePrice) <= 0) {
      errs.salePrice = 'Sale price must be a positive number.';
    } else if (Number(formData.salePrice) >= Number(formData.price)) {
      errs.salePrice = 'Sale price must be less than the regular price.';
    }
  }

  if (
    formData.quantity !== '' &&
    (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0)
  ) {
    errs.quantity = 'Stock quantity must be 0 or more.';
  }

  if (formData.shortDescription && formData.shortDescription.length > 500) {
    errs.shortDescription = 'Short description must be 500 characters or less.';
  }

  if (formData.sku && formData.sku.length > 100) {
    errs.sku = 'SKU must be 100 characters or less.';
  }

  return errs;
};

const ProductEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();
  const isNew = !id || id === 'new';

<<<<<<< HEAD
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
=======
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    sku: '',
    price: '',
    salePrice: '',
    quantity: '',
    status: 'draft',
    categoryIds: [],
    images: [],
  });
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await getCategoryTree();
        setCategories(catRes?.data?.categories || []);

        if (!isNew) {
          const prodRes = await getProductById(id);
          if (prodRes?.data?.product) {
            const p = prodRes.data.product;
            setFormData({
              name: p.name,
              description: p.description || '',
              shortDescription: p.shortDescription || '',
              sku: p.sku || '',
              price: p.price,
              salePrice: p.salePrice || '',
              quantity: p.quantity,
              status: p.status,
              categoryIds: p.categories?.map((c) => c.id) || [],
              images: p.images || [],
            });
          }
>>>>>>> 93a4558 (fix admin panel)
        }
      } catch (err) {
        notify('Failed to load product data.', 'error');
      }
    };
    load();
  }, [id, isNew]);

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate(formData);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      notify('Please fix the validation errors before saving.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        salePrice:
          formData.salePrice !== '' && formData.salePrice !== null
            ? parseFloat(formData.salePrice)
            : null,
        quantity: parseInt(formData.quantity) || 0,
      };
      if (isNew) {
        await createProduct(payload);
        notify('Product created successfully!', 'success');
      } else {
        await updateProduct(id, payload);
        notify('Product updated successfully!', 'success');
      }
      navigate('/admin/products');
    } catch (err) {
      notify(err.response?.data?.error?.message || err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = (media) => {
    setFormData((prev) => ({
      ...prev,
      images: [
        ...prev.images,
        {
          url: media.url,
          mediaId: media.id,
          alt: 'Product Image',
          isPrimary: prev.images.length === 0,
        },
      ],
    }));
  };

  const flatCatFiles = [];
  const flatten = (arr) => {
    arr.forEach((c) => {
      flatCatFiles.push(c);
      if (c.children?.length) flatten(c.children);
    });
  };
  flatten(categories);

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        {isNew ? 'Create Product' : 'Edit Product'}
      </Typography>
      <form onSubmit={handleSave} noValidate>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Basic Info
              </Typography>
              <TextField
                fullWidth
                label="Product Name *"
                margin="normal"
                value={formData.name}
                onChange={(e) => setField('name', e.target.value)}
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                fullWidth
                label="Short Description"
                margin="normal"
                value={formData.shortDescription}
                onChange={(e) => setField('shortDescription', e.target.value)}
                error={Boolean(errors.shortDescription)}
                helperText={errors.shortDescription || 'Max 500 characters'}
                inputProps={{ maxLength: 500 }}
              />
              <TextField
                fullWidth
                label="Full Description"
                margin="normal"
                multiline
                rows={6}
                value={formData.description}
                onChange={(e) => setField('description', e.target.value)}
              />
              <Typography variant="caption" color="text.secondary">
                Supports HTML formatting
              </Typography>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Pricing
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Price *"
                    type="number"
                    inputProps={{ step: '0.01', min: 0 }}
                    value={formData.price}
                    onChange={(e) => setField('price', e.target.value)}
                    error={Boolean(errors.price)}
                    helperText={errors.price}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Sale Price"
                    type="number"
                    inputProps={{ step: '0.01', min: 0 }}
                    value={formData.salePrice}
                    onChange={(e) => setField('salePrice', e.target.value)}
                    error={Boolean(errors.salePrice)}
                    helperText={errors.salePrice || 'Must be less than regular price'}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Media / Images
              </Typography>
              <MediaUploader onUploadSuccess={handleMediaUpload} />
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setField('status', e.target.value)}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="published">Published</MenuItem>
                </Select>
              </FormControl>
            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Organization
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Categories</InputLabel>
                <Select
                  multiple
                  value={formData.categoryIds}
                  onChange={(e) =>
                    setField(
                      'categoryIds',
                      typeof e.target.value === 'string'
                        ? e.target.value.split(',')
                        : e.target.value
                    )
                  }
                  input={<OutlinedInput label="Categories" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const cat = flatCatFiles.find((c) => c.id === value);
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
              <Typography variant="h6" gutterBottom>
                Inventory
              </Typography>
              <TextField
                fullWidth
                label="SKU"
                margin="normal"
                value={formData.sku}
                onChange={(e) => setField('sku', e.target.value)}
                error={Boolean(errors.sku)}
                helperText={errors.sku}
              />
              <TextField
                fullWidth
                label="Stock Quantity *"
                type="number"
                margin="normal"
                inputProps={{ min: 0 }}
                value={formData.quantity}
                onChange={(e) => setField('quantity', e.target.value)}
                error={Boolean(errors.quantity)}
                helperText={errors.quantity}
              />
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={() => navigate('/admin/products')} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" size="large" disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default ProductEditPage;
