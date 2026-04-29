import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Table,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  CircularProgress,
  Tooltip,
  IconButton,
  Divider,
  Alert,
  InputAdornment,
  Autocomplete,
  Tabs,
  Tab,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  ElectricBolt as ElectricBoltIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { getMediaUrl } from '../../utils/media';
import useSKUGenerator from '../../hooks/useSKUGenerator';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { getProductById, getProducts, createProduct, updateProduct } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import brandService from '../../services/brandService';
import attributeService from '../../services/attributeService';
import { getSaleLabels } from '../../services/adminService';
import MediaUploader from '../../components/common/MediaUploader';
import { useNotification } from '../../context/NotificationContext';
import { useSettings } from '../../hooks/useSettings';
import { getProductBasePrice } from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const validate = (formData) => {
  const errs = {};
  if (!formData.name?.trim()) errs.name = 'Product name is required.';
  else if (formData.name?.trim().length > 255)
    errs.name = 'Product name must be 255 characters or less.';

  const rPrice = Number(formData.price);
  if (formData.price === '' || formData.price === null || formData.price === undefined) {
    errs.price = 'Price is required.';
  } else if (isNaN(rPrice) || rPrice <= 0) {
    errs.price = 'Price must be a positive number.';
  }

  if (formData.salePrice !== '' && formData.salePrice !== null) {
    const sPrice = Number(formData.salePrice);
    if (isNaN(sPrice) || sPrice <= 0) {
      errs.salePrice = 'Sale price must be a positive number.';
    } else if (!isNaN(rPrice) && rPrice > 0 && sPrice >= rPrice) {
      errs.salePrice = 'Sale price must be less than the regular price.';
    }
  }

  // Only require sale price if a sale is actively being scheduled via dates
  if ((formData.saleStartAt || formData.saleEndAt) && (formData.salePrice === '' || formData.salePrice === null)) {
    errs.salePrice = 'Add a sale price before scheduling a sale.';
  }

  if (formData.saleStartAt && formData.saleEndAt && new Date(formData.saleEndAt) <= new Date(formData.saleStartAt)) {
    errs.saleEndAt = 'Sale end must be after the start date.';
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

  if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
    errs.slug = 'Slug can only contain lowercase letters, numbers, and hyphens.';
  } else if (formData.slug && formData.slug.length > 255) {
    errs.slug = 'Slug must be 255 characters or less.';
  }

  // Tax Configuration Validation
  if (formData.taxConfig?.isCustom) {
    const { sgst, cgst, igst } = formData.taxConfig;
    if (isNaN(Number(sgst)) || sgst < 0 || sgst > 1) {
      errs.taxConfig = 'SGST must be between 0 and 100%.';
    } else if (isNaN(Number(cgst)) || cgst < 0 || cgst > 1) {
      errs.taxConfig = 'CGST must be between 0 and 100%.';
    } else if (isNaN(Number(igst)) || igst < 0 || igst > 1) {
      errs.taxConfig = 'IGST must be between 0 and 100%.';
    }
  }

  return errs;
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const ProductEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify, confirm } = useNotification();
  const { settings } = useSettings();
  const { hasPermission } = useAuth();
  const isNew = !id || id === 'new';
  const { generateProductSKU } = useSKUGenerator();
  const sales = settings?.sales || {};
  const canCreateProducts = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProducts = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const canSaveProduct = isNew ? canCreateProducts : canUpdateProducts;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    sku: '',
    price: '',
    salePrice: '',
    saleStartAt: '',
    saleEndAt: '',
    saleLabel: '',
    quantity: '',
    status: 'draft',
    isEnabled: true,
    categoryIds: [],
    brandId: '',
    images: [],
    taxConfig: {
      isCustom: false,
      inclusive: false,
      sgst: 0.09,
      cgst: 0.09,
      igst: 0.18,
    },
    // Shipping dimensions
    requiresShipping: true,
    weightGrams: '',
    lengthCm: '',
    breadthCm: '',
    heightCm: '',
  });
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saleLabels, setSaleLabels] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await getCategoryTree();
        setCategories(catRes?.data || []);

        const brandRes = await brandService.getBrands({ limit: 100, isActive: 'true' });
        setBrands(brandRes?.data?.data || []);

        try {
          const labelsRes = await getSaleLabels();
          const fetchedLabels = labelsRes.data?.data || [];
          setSaleLabels(fetchedLabels.filter(l => l.isActive));
        } catch (e) {
          console.error('Failed to load sale labels', e);
        }

        if (!isNew) {
          const prodRes = await getProductById(id);
          if (prodRes?.data) {
            const p = prodRes.data;
            setFormData({
              name: p.name || '',
              slug: p.slug || '',
              description: p.description || '',
              shortDescription: p.shortDescription || '',
              sku: p.sku || '',
              price: p.price || '',
              salePrice: p.salePrice || '',
              saleStartAt: toDateTimeLocal(p.saleStartAt),
              saleEndAt: toDateTimeLocal(p.saleEndAt),
              saleLabel: p.saleLabel || '',
              quantity: p.quantity || 0,
              status: p.status || 'draft',
              isEnabled: p.isEnabled ?? true,
              categoryIds: p.categories?.map((c) => c.id) || [],
              brandId: p.brandId || '',
              images: p.images || [],
              taxConfig: p.taxConfig || {
                isCustom: false,
                inclusive: false,
                sgst: 0.09,
                cgst: 0.09,
                igst: 0.18,
              },
              // Shipping dimensions
              requiresShipping: p.requiresShipping ?? true,
              weightGrams: p.weightGrams ?? '',
              lengthCm:    p.lengthCm    ?? '',
              breadthCm:   p.breadthCm   ?? '',
              heightCm:    p.heightCm    ?? '',
            });
          }
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
    if (!canSaveProduct) {
      notify(`You do not have permission to ${isNew ? 'create' : 'update'} products.`, 'error');
      return;
    }

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
        saleStartAt: formData.salePrice ? toIsoOrNull(formData.saleStartAt) : null,
        saleEndAt: formData.salePrice ? toIsoOrNull(formData.saleEndAt) : null,
        saleLabel: formData.salePrice ? (formData.saleLabel || null) : null,
        brandId: formData.brandId || null,
        quantity: parseInt(formData.quantity) || 0,
        // Shipping dimensions — null when blank so DB stores NULL cleanly
        requiresShipping: formData.requiresShipping,
        weightGrams: formData.weightGrams !== '' ? parseInt(formData.weightGrams, 10) : null,
        lengthCm:    formData.lengthCm    !== '' ? parseInt(formData.lengthCm, 10)    : null,
        breadthCm:   formData.breadthCm   !== '' ? parseInt(formData.breadthCm, 10)   : null,
        heightCm:    formData.heightCm    !== '' ? parseInt(formData.heightCm, 10)    : null,
      };
      if (isNew) {
        const res = await createProduct(payload);
        const newId = res?.data?.id;

        if (!newId) {
          notify('Product created but ID not returned. Please refresh the product list.', 'warning');
          navigate('/admin/products');
          return;
        }

        notify('Product created successfully. You can now add variants below.', 'success');
        navigate(`/admin/products/${newId}/edit`, { replace: true });
      } else {
        await updateProduct(id, payload);
        notify('Product updated successfully.', 'success');
      }
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = (media) => {
    if (!canSaveProduct || !canUploadMedia) {
      notify('You do not have permission to upload product media.', 'error');
      return;
    }

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

  const handleRemoveImage = (index) => {
    if (!canSaveProduct) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSetPrimaryImage = (index) => {
    if (!canSaveProduct) {
      notify('You do not have permission to update products.', 'error');
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      })),
    }));
  };

  // Build a flat list of every category node with depth + full breadcrumb path.
  // e.g. { id, name, depth: 2, path: 'Vegetable › Roots › Beetroot' }
  const flatCatFiles = [];
  const flattenWithDepth = (arr, depth = 0, parentPath = '') => {
    arr.forEach((c) => {
      const path = parentPath ? `${parentPath} › ${c.name}` : c.name;
      flatCatFiles.push({ ...c, depth, path });
      if (c.children?.length) flattenWithDepth(c.children, depth + 1, path);
    });
  };
  flattenWithDepth(categories);

  return (
    <Box sx={{ p: 3, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
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
                size='small'
                value={formData.name}
                onChange={(e) => {
                  setField('name', e.target.value);
                  if (isNew && (!formData.slug || formData.slug === generateSlug(formData.name))) {
                    setField('slug', generateSlug(e.target.value));
                  }
                }}
                error={Boolean(errors.name)}
                helperText={errors.name}
              />
              <TextField
                fullWidth
                label="Slug"
                margin="normal"
                size='small'
                value={formData.slug}
                onChange={(e) => setField('slug', e.target.value)}
                error={Boolean(errors.slug)}
                helperText={errors.slug || 'Leave blank to auto-generate from name'}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Auto-generate slug from name">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => setField('slug', generateSlug(formData.name))}
                            disabled={!formData.name?.trim()}
                          >
                            <ElectricBoltIcon fontSize="small" color="warning" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Short Description"
                margin="normal"
                size='small'
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
                size='small'
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
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
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
                    InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                    inputProps={{ step: '0.01', min: 0 }}
                    value={formData.salePrice}
                    onChange={(e) => setField('salePrice', e.target.value)}
                    error={Boolean(errors.salePrice)}
                    helperText={errors.salePrice || 'Must be less than regular price'}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" disabled={!formData.salePrice}>
                    <InputLabel id="sale-label-select">Sale Label</InputLabel>
                    <Select
                      labelId="sale-label-select"
                      value={formData.saleLabel || ''}
                      label="Sale Label"
                      onChange={(e) => setField('saleLabel', e.target.value)}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {saleLabels.map((lbl) => (
                        <MenuItem key={lbl.id} value={lbl.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: lbl.color || '#000',
                                mr: 1,
                              }}
                            />
                            {lbl.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      {!formData.salePrice
                        ? 'Add a sale price to enable scheduling.'
                        : 'Select a predefined sale label from your catalog.'}
                    </FormHelperText>
                  </FormControl>
                </Grid>
                {sales.allowScheduling !== false && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Sale Starts"
                        type="datetime-local"
                        size="small"
                        value={formData.saleStartAt}
                        onChange={(e) => setField('saleStartAt', e.target.value)}
                        disabled={!formData.salePrice}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Sale Ends"
                        type="datetime-local"
                        size="small"
                        value={formData.saleEndAt}
                        onChange={(e) => setField('saleEndAt', e.target.value)}
                        disabled={!formData.salePrice}
                        error={Boolean(errors.saleEndAt)}
                        helperText={errors.saleEndAt || 'Leave blank for an open-ended sale'}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </>
                )}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      onClick={() => {
                        setField('salePrice', '');
                        setField('saleStartAt', '');
                        setField('saleEndAt', '');
                        setField('saleLabel', '');
                      }}
                      disabled={!formData.salePrice && !formData.saleStartAt && !formData.saleEndAt && !formData.saleLabel}
                    >
                      Clear Sale
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Media / Images
              </Typography>
              {canUploadMedia ? (
                <MediaUploader onUploadSuccess={handleMediaUpload} multiple />
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You can edit product details, but media upload requires the media upload permission.
                </Alert>
              )}

              {formData.images.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom color="text.secondary">
                    {formData.images.length} images uploaded
                  </Typography>
                  <Grid container spacing={2}>
                    {formData.images.map((img, index) => (
                      <Grid item xs={6} sm={4} md={2} key={img.id || index}>
                        <Paper
                          variant="outlined"
                          sx={{
                            position: 'relative',
                            pt: '100%', // 1:1 Aspect Ratio
                            overflow: 'hidden',
                            borderRadius: 2,
                            borderColor: img.isPrimary ? 'primary.main' : 'divider',
                            borderWidth: img.isPrimary ? 2 : 1,
                            '&:hover .image-actions': { opacity: 1 },
                          }}
                        >
                          <Box
                            component="img"
                            src={getMediaUrl(img.url)}
                            alt={img.alt}
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          {/* Overlay actions */}
                          <Box
                            className="image-actions"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              bgcolor: 'rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            <Tooltip title={img.isPrimary ? 'Primary Image' : 'Set as Primary'}>
                              <IconButton
                                size="small"
                                sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'primary.50' } }}
                                onClick={() => handleSetPrimaryImage(index)}
                                color={img.isPrimary ? 'warning' : 'default'}
                                disabled={!canSaveProduct}
                              >
                                {img.isPrimary ? <StarIcon /> : <StarBorderIcon />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove Image">
                              <IconButton
                                size="small"
                                sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'error.50' } }}
                                onClick={() => handleRemoveImage(index)}
                                color="error"
                                disabled={!canSaveProduct}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          {img.isPrimary && (
                            <Chip
                              label="Primary"
                              size="small"
                              color="primary"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                fontWeight: 700,
                                height: 20,
                                '& .MuiChip-label': { px: 1 },
                              }}
                            />
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
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
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) => setField('isEnabled', e.target.checked)}
                    color="success"
                  />
                }
                label="Enabled on storefront"
                sx={{ mt: 2 }}
              />
            </Paper>
            
            <TaxConfigSection 
              taxConfig={formData.taxConfig} 
              basePrice={formData.price}
              setTaxConfig={(val) => setField('taxConfig', val)}
              globalSettings={settings?.checkout || {}}
              disabled={!canSaveProduct}
            />

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Organization
              </Typography>
              <Autocomplete
                multiple
                options={flatCatFiles}
                getOptionLabel={(o) => o.path || o.name}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                value={flatCatFiles.filter((c) => formData.categoryIds.includes(c.id))}
                onChange={(_, newValue) =>
                  setField('categoryIds', newValue.map((c) => c.id))
                }
                renderOption={(props, option) => (
                  <Box
                    component="li"
                    {...props}
                    key={option.id}
                    sx={{ pl: `${(option.depth * 16) + 8}px !important`, py: '6px !important' }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" fontWeight={option.depth === 0 ? 700 : 400}>
                        {option.name}
                      </Typography>
                      {option.depth > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                          {option.path}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...tagProps } = getTagProps({ index });
                    return (
                      <Chip
                        key={key || option.id}
                        label={option.depth > 0 ? option.path : option.name}
                        size="small"
                        title={option.path}
                        {...tagProps}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Categories"
                    placeholder={formData.categoryIds.length === 0 ? 'Search or select…' : ''}
                    margin="normal"
                  />
                )}
                groupBy={(o) => {
                  // Group by root category name for visual separation
                  const root = flatCatFiles.find(
                    (c) => c.depth === 0 && (c.id === o.id || o.path.startsWith(c.name))
                  );
                  return root?.name || o.name;
                }}
                noOptionsText="No categories found"
                disableCloseOnSelect
                sx={{ mt: 1 }}
              />

              <FormControl fullWidth margin="normal">
                <InputLabel id="brand-select-label">Brand</InputLabel>
                <Select
                  labelId="brand-select-label"
                  value={formData.brandId}
                  label="Brand"
                  onChange={(e) => setField('brandId', e.target.value)}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {brands.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
                {/* <FormHelperText>Select a product brand</FormHelperText> */}
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
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Auto-generate SKU from product name (uses SKU settings)">
                        <span>
                        <IconButton
                          size="small"
                          onClick={() => setField('sku', generateProductSKU(formData.name))}
                          disabled={!formData.name?.trim()}
                        >
                          <ElectricBoltIcon fontSize="small" color="warning" />
                        </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
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

            {/* ---- Shipping & Dimensions ---- */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Shipping &amp; Dimensions
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.requiresShipping}
                    onChange={(e) => setField('requiresShipping', e.target.checked)}
                  />
                }
                label="This product requires shipping"
                sx={{ mb: 2 }}
              />

              {formData.requiresShipping && (
                <>
                  <TextField
                    fullWidth
                    label="Weight (grams)"
                    type="number"
                    margin="normal"
                    size="small"
                    inputProps={{ min: 0, step: 1 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">g</InputAdornment>,
                    }}
                    value={formData.weightGrams}
                    onChange={(e) => setField('weightGrams', e.target.value)}
                    helperText="Actual product weight (packaging included)"
                  />
                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Dimensions (cm)</Typography>
                  <Grid container spacing={1.5}>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth label="Length" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.lengthCm}
                        onChange={(e) => setField('lengthCm', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth label="Breadth" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.breadthCm}
                        onChange={(e) => setField('breadthCm', e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        fullWidth label="Height" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.heightCm}
                        onChange={(e) => setField('heightCm', e.target.value)}
                      />
                    </Grid>
                  </Grid>

                  {/* Live volumetric weight preview */}
                  {formData.lengthCm && formData.breadthCm && formData.heightCm && (
                    (() => {
                      const volWeight = Math.ceil(
                        (Number(formData.lengthCm) * Number(formData.breadthCm) * Number(formData.heightCm)) / 4000
                      ) * 1000; // in grams, divisor 4000 → result in kg × 1000
                      const actual = Number(formData.weightGrams) || 0;
                      const chargeable = Math.ceil(Math.max(actual, volWeight) / 500) * 500;
                      return (
                        <Box sx={{
                          mt: 2, p: 1.5, borderRadius: 1,
                          bgcolor: 'action.hover',
                          border: '1px dashed', borderColor: 'divider'
                        }}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Volumetric weight: <strong>{volWeight} g</strong>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Actual weight: <strong>{actual} g</strong>
                          </Typography>
                          <Typography variant="caption" color="primary.main" fontWeight={700} display="block">
                            Chargeable weight (rounded): {chargeable} g
                          </Typography>
                        </Box>
                      );
                    })()
                  )}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={() => navigate('/admin/products')} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" type="submit" size="large" disabled={saving || !canSaveProduct}>
            {saving ? 'Saving…' : 'Save Product'}
          </Button>
        </Box>
      </form>

      {/* Variants panel — only visible once the product has been saved and has a real ID */}
      {!isNew && <VariantsPanel productId={id} baseSku={formData.sku} flatCatFiles={flatCatFiles} canManageVariants={canUpdateProducts} />}
    </Box>
  );
};

/* ─── Tax Configuration Section ────────────────────────────────────────────── */
const TaxConfigSection = ({ taxConfig, basePrice, setTaxConfig, globalSettings, disabled }) => {
  const handleChange = (field, value) => {
    setTaxConfig({ ...taxConfig, [field]: value });
  };

  // Live tax preview logic
  const isGST = globalSettings.enableCGST || globalSettings.enableSGST || globalSettings.enableIGST;
  const currentPrice = parseFloat(basePrice) || 0;
  
  const effective = taxConfig.isCustom ? taxConfig : {
    sgst: parseFloat(globalSettings.sgstRate || 0),
    cgst: parseFloat(globalSettings.cgstRate || 0),
    igst: parseFloat(globalSettings.igstRate || 0),
    inclusive: globalSettings.inclusive,
  };

  const sgstAmount = currentPrice * (effective.sgst || 0);
  const cgstAmount = currentPrice * (effective.cgst || 0);
  const igstAmount = currentPrice * (effective.igst || 0);
  const taxTotal = sgstAmount + cgstAmount; // Showing intra-state preview usually

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          Tax Configuration
        </Typography>
        <FormControlLabel
          control={
            <Checkbox 
              checked={taxConfig.isCustom} 
              onChange={(e) => handleChange('isCustom', e.target.checked)}
              disabled={disabled}
            />
          }
          label={<Typography variant="body2" fontWeight={500}>Custom Tax</Typography>}
        />
      </Box>

      {!taxConfig.isCustom ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Using global tax settings ({((parseFloat(globalSettings.sgstRate || 0) + parseFloat(globalSettings.cgstRate || 0)) * 100).toFixed(0)}% GST).
        </Alert>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={taxConfig.inclusive} 
                  onChange={(e) => handleChange('inclusive', e.target.checked)}
                  disabled={disabled}
                />
              }
              label="Prices include tax"
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="SGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.sgst * 100).toFixed(2)}
              onChange={(e) => handleChange('sgst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="CGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.cgst * 100).toFixed(2)}
              onChange={(e) => handleChange('cgst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              label="IGST (%)"
              type="number"
              fullWidth
              size="small"
              value={(taxConfig.igst * 100).toFixed(2)}
              onChange={(e) => handleChange('igst', parseFloat(e.target.value) / 100)}
              disabled={disabled}
            />
          </Grid>
        </Grid>
      )}

      {currentPrice > 0 && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            INTRA-STATE PREVIEW (ESTIMATE)
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">Subtotal:</Typography>
            <Typography variant="body2" fontWeight={500}>₹{currentPrice.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">Tax (Estimated):</Typography>
            <Typography variant="body2" fontWeight={500}>+ ₹{taxTotal.toFixed(2)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">Total:</Typography>
            <Typography variant="subtitle2" color="primary.main">₹{(currentPrice + taxTotal).toFixed(2)}</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
};


/* ─── Variants Panel ──────────────────────────────────────────────────────── */
const VariantsPanel = ({ productId, flatCatFiles = [], canManageVariants = false }) => {
  const { notify, confirm } = useNotification();
  const [productAttributes, setProductAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [productBasePrice, setProductBasePrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedValueIds, setSelectedValueIds] = useState([]);
  const [customName, setCustomName] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customIsVariant, setCustomIsVariant] = useState(false);
  const [globalIsVariant, setGlobalIsVariant] = useState(false);
  const [attributeTab, setAttributeTab] = useState(0);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneTab, setCloneTab] = useState(0);
  const [cloneSearchInput, setCloneSearchInput] = useState('');
  const [cloneSearchResults, setCloneSearchResults] = useState([]);
  const [cloneSearchLoading, setCloneSearchLoading] = useState(false);
  const [cloneSelectedProduct, setCloneSelectedProduct] = useState(null);
  const [cloneCatId, setCloneCatId] = useState('');
  const [cloneCatProducts, setCloneCatProducts] = useState([]);
  const [cloneCatProductsLoading, setCloneCatProductsLoading] = useState(false);
  const [cloneCatSelectedProduct, setCloneCatSelectedProduct] = useState(null);
  const cloneSearchTimer = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [attrRowsRes, varRes, attrRes, productRes] = await Promise.all([
        attributeService.getProductAttributes(productId),
        attributeService.getProductVariants(productId),
        attributeService.getAttributes({ limit: 100 }),
        getProductById(productId),
      ]);
      const attrRows = attrRowsRes?.data?.data || [];
      const varData = varRes?.data?.data || [];
      const attrData = attrRes?.data?.data?.rows || attrRes?.data?.data || [];
      const product = productRes?.data || null;
      setProductAttributes(attrRows);
      setVariants(varData.map((variant) => ({
        ...variant,
        price: variant.price ?? product?.effectivePrice ?? product?.price ?? 0,
        stockQty: variant.stockQty ?? 0,
        _dirty: false,
      })));
      setAttributes(attrData);
      setProductBasePrice(getProductBasePrice(product));
    } catch (error) {
      notify('Failed to load product options.', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, notify]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectedTemplateRecord = attributes.find((attribute) => attribute.id === selectedTemplate);
  const variantAttributeRows = productAttributes.filter((row) => row.isVariantAttr);
  const canGenerateMatrix = variantAttributeRows.some((row) => row.attributeId) && variantAttributeRows.length > 0;
  const hasVariantChanges = variants.some((variant) => variant._dirty);

  const handleAddGlobalAttributes = async () => {
    if (!canManageVariants || !selectedTemplate || selectedValueIds.length === 0) {
      return;
    }

    try {
      await Promise.all(selectedValueIds.map((valueId) => (
        attributeService.addProductAttribute(productId, {
          attributeId: selectedTemplate,
          valueId,
          isVariantAttr: globalIsVariant,
        })
      )));
      setSelectedTemplate('');
      setSelectedValueIds([]);
      setGlobalIsVariant(false);
      notify('Product attributes added.', 'success');
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to add product attributes.', 'error');
    }
  };

  const handleAddCustomAttribute = async () => {
    if (!canManageVariants || !customName?.trim() || !customValue?.trim()) {
      return;
    }

    try {
      const values = customValue.split('|').map(v => v.trim()).filter(Boolean);
      await Promise.all(values.map(val => 
        attributeService.addProductAttribute(productId, {
          customName: customName.trim(),
          customValue: val,
          isVariantAttr: customIsVariant,
        })
      ));
      setCustomName('');
      setCustomValue('');
      setCustomIsVariant(false);
      notify('Custom attribute(s) added.', 'success');
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to add custom attribute.', 'error');
    }
  };

  const handleToggleVariantAttribute = async (row) => {
    if (!canManageVariants) return;
    if (!row.attributeId) {
      notify('Only global attributes can be used to generate variant SKUs.', 'warning');
      return;
    }

    try {
      await attributeService.updateProductAttribute(productId, row.id, {
        isVariantAttr: !row.isVariantAttr,
      });
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to update attribute.', 'error');
    }
  };

  const handleDeleteAttribute = async (rowId) => {
    if (!canManageVariants) return;
    const confirmed = await confirm(
      'Remove Attribute Assignment',
      'Remove this attribute assignment? This will prune any variants that rely on this attribute during the next Matrix generation.',
      'warning'
    );
    if (!confirmed) return;
    try {
      await attributeService.deleteProductAttribute(productId, rowId);
      notify('Attribute removed.', 'success');
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to remove attribute.', 'error');
    }
  };

  const handleGenerateVariants = async () => {
    if (!canManageVariants) return;
    try {
      await attributeService.bulkGenerateVariants(productId, {
        defaultPrice: productBasePrice,
        defaultStockQty: 0,
      });
      notify('Variant matrix generated from selected variant attributes.', 'success');
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to generate variants.', 'error');
    }
  };

  const handleVariantChange = (index, field, value) => {
    if (!canManageVariants) return;
    setVariants((current) => current.map((variant, currentIndex) => (
      currentIndex === index ? { ...variant, [field]: value, _dirty: true } : variant
    )));
  };

  const handleSaveVariants = async () => {
    if (!canManageVariants || !hasVariantChanges) return;
    setSaving(true);
    try {
      const dirtyVariants = variants.filter((variant) => variant._dirty);
      for (const variant of dirtyVariants) {
        await attributeService.updateProductVariant(productId, variant.id, {
          sku: variant.sku?.trim() || null,
          price: Number(variant.price || 0),
          stockQty: Number(variant.stockQty || 0),
          isActive: variant.isActive !== false,
          sortOrder: Number(variant.sortOrder || 0),
        });
      }
      notify('Variants updated.', 'success');
      loadAll();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save variants.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!canManageVariants) return;
    const confirmed = await confirm(
      'Delete Variant',
      'Delete this variant SKU?',
      'error'
    );
    if (!confirmed) return;
    try {
      await attributeService.deleteProductVariant(productId, variantId);
      notify('Variant deleted.', 'success');
      loadAll();
    } catch (error) {
      notify(error?.response?.data?.error?.message || 'Failed to delete variant.', 'error');
    }
  };

  const handleClone = async () => {
    if (!canManageVariants) return;
    const activeProduct = cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct;
    if (!activeProduct) return;
    setCloning(true);
    try {
      await attributeService.cloneVariants(productId, { sourceProductId: activeProduct.id });
      notify(`Variants cloned from "${activeProduct.name}" successfully.`, 'success');
      setCloneOpen(false);
      setCloneSelectedProduct(null);
      setCloneSearchInput('');
      setCloneSearchResults([]);
      setCloneCatSelectedProduct(null);
      setCloneCatId('');
      setCloneCatProducts([]);
      loadAll();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Clone failed.'), 'error');
    } finally {
      setCloning(false);
    }
  };

  const handleCloneSearchChange = (inputValue) => {
    setCloneSearchInput(inputValue);
    setCloneSelectedProduct(null);
    clearTimeout(cloneSearchTimer.current);
    if (!inputValue?.trim()) { setCloneSearchResults([]); return; }
    cloneSearchTimer.current = setTimeout(async () => {
      setCloneSearchLoading(true);
      try {
        const res = await getProducts({ search: inputValue.trim(), limit: 20 });
        const rows = res?.data || [];
        setCloneSearchResults(rows.filter((product) => product.id !== productId));
      } catch {
        setCloneSearchResults([]);
      } finally {
        setCloneSearchLoading(false);
      }
    }, 350);
  };

  const handleCloneCatChange = async (catId) => {
    setCloneCatId(catId);
    setCloneCatSelectedProduct(null);
    setCloneCatProducts([]);
    if (!catId) return;
    setCloneCatProductsLoading(true);
    try {
      const res = await getProducts({ categoryId: catId, limit: 100 });
      const rows = res?.data || [];
      setCloneCatProducts(rows.filter((product) => product.id !== productId));
    } catch {
      setCloneCatProducts([]);
    } finally {
      setCloneCatProductsLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Attributes and Variants
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Assign product specifications first, then mark which global attributes should generate purchasable SKUs.
        Manage reusable templates in <Link to="/admin/attributes" style={{ color: 'inherit', fontWeight: 600 }}>Attributes {'->'}</Link>
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Product Attributes
              </Typography>
            </Box>

            <Tabs value={attributeTab} onChange={(e, val) => setAttributeTab(val)} sx={{ mb: 2 }}>
              <Tab label="Add new" />
              <Tab label="Add existing" />
            </Tabs>

            {attributeTab === 1 && (
              <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Global Attribute</InputLabel>
                  <Select
                    label="Global Attribute"
                    value={selectedTemplate}
                    onChange={(e) => {
                      setSelectedTemplate(e.target.value);
                      setSelectedValueIds([]);
                    }}
                  >
                    <MenuItem value=""><em>Select attribute</em></MenuItem>
                    {attributes.map((attribute) => (
                      <MenuItem key={attribute.id} value={attribute.id}>{attribute.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth disabled={!selectedTemplateRecord}>
                  <InputLabel>Attribute Values</InputLabel>
                  <Select
                    multiple
                    value={selectedValueIds}
                    label="Attribute Values"
                    input={<OutlinedInput label="Attribute Values" />}
                    onChange={(e) => setSelectedValueIds(e.target.value)}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {selected.map((valueId) => {
                          const valueRecord = selectedTemplateRecord?.values?.find((value) => value.id === valueId);
                          return <Chip key={valueId} size="small" label={valueRecord?.value || valueId} />;
                        })}
                      </Box>
                    )}
                  >
                    {(selectedTemplateRecord?.values || []).map((value) => (
                      <MenuItem key={value.id} value={value.id}>{value.value}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={globalIsVariant}
                      onChange={(e) => setGlobalIsVariant(e.target.checked)}
                      disabled={!canManageVariants}
                    />
                  }
                  label={<Typography variant="body2">Used for variations</Typography>}
                />

                <Button variant="outlined" onClick={handleAddGlobalAttributes} disabled={!canManageVariants || !selectedTemplate || selectedValueIds.length === 0}>
                  Add Global Attribute Values
                </Button>
              </Box>
            )}

            {attributeTab === 0 && (
              <Box sx={{ display: 'grid', gap: 1.5, mb: 2.5 }}>
                <TextField
                  size="small"
                  label="Name: e.g. length or weight"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  disabled={!canManageVariants}
                />
                <TextField
                  size="small"
                  label="Value(s)"
                  placeholder='Enter descriptive text. Use "|" to separate different values.'
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  disabled={!canManageVariants}
                  multiline
                  rows={2}
                />

                <Box sx={{ display: 'flex', flexDirection: 'column', mt: -1 }}>
                  {/* <FormControlLabel
                    control={<Checkbox checked={true} disabled />}
                    label={<Typography variant="body2">Visible on the product page</Typography>}
                    sx={{ mb: -1 }}
                  /> */}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={customIsVariant}
                        onChange={(e) => setCustomIsVariant(e.target.checked)}
                        disabled={!canManageVariants}
                      />
                    }
                    label={<Typography variant="body2">Used for variations</Typography>}
                  />
                </Box>

                <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddCustomAttribute} disabled={!canManageVariants || !customName?.trim() || !customValue?.trim()}>
                  Add Custom Attribute
                </Button>
              </Box>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : productAttributes.length === 0 ? (
              <Alert severity="info">No product attributes yet. Add specifications above before generating variants.</Alert>
            ) : (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {Object.entries(
                  productAttributes.reduce((acc, row) => {
                    const label = row.attribute?.name || row.customName || 'Other';
                    if (!acc[label]) acc[label] = [];
                    acc[label].push(row);
                    return acc;
                  }, {})
                ).map(([label, rows]) => (
                  <Accordion key={label} defaultExpanded={false} variant="outlined" sx={{ m: '0 !important' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography fontWeight={700}>{label} ({rows.length})</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ display: 'grid', gap: 1, p: 2, pt: 0 }}>
                      {rows.map((row) => {
                        const value = row.value?.value || row.customValue;
                        return (
                          <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                              <Box>
                                <Typography variant="body2" color="text.secondary" fontWeight={500}>{value}</Typography>
                                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                  <Chip size="small" label={row.attributeId ? 'Global' : 'Custom'} variant="outlined" />
                                  <Chip size="small" label={row.isVariantAttr ? 'Variant SKU attribute' : 'Display only'} color={row.isVariantAttr ? 'primary' : 'default'} />
                                </Box>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <Button size="small" variant={row.isVariantAttr ? 'contained' : 'outlined'} onClick={() => handleToggleVariantAttribute(row)} disabled={!canManageVariants}>
                                  {row.isVariantAttr ? 'Used for Variants' : 'Mark for Variants'}
                                </Button>
                                <IconButton size="small" color="error" onClick={() => handleDeleteAttribute(row.id)} disabled={!canManageVariants}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          </Paper>
                        );
                      })}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Variant SKUs
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button variant="outlined" size="small" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => setCloneOpen(true)} disabled={!canManageVariants}>
                  Clone from Product
                </Button>
                <Button variant="outlined" size="small" onClick={handleGenerateVariants} disabled={!canManageVariants || !canGenerateMatrix}>
                  Generate Matrix
                </Button>
                <Button variant="contained" size="small" onClick={handleSaveVariants} disabled={!canManageVariants || !hasVariantChanges || saving}>
                  {saving ? 'Saving...' : 'Save Variant Changes'}
                </Button>
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Mark attributes like Color or Size as variant-forming, then generate one SKU row per combination. Price and stock are stored on the SKU row itself.
            </Typography>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
              {variantAttributeRows.length === 0 ? (
                <Chip size="small" label="No variant-forming attributes selected yet" variant="outlined" />
              ) : variantAttributeRows.map((row) => (
                <Chip key={row.id} size="small" color="primary" label={`${row.attribute?.name || row.customName}: ${row.value?.value || row.customValue}`} />
              ))}
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : variants.length === 0 ? (
              <Alert severity="info">
                No variants yet. Add product attributes and mark the SKU-defining ones first, then click <strong>Generate Matrix</strong>.
              </Alert>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Combination</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Price</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Stock Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variants.map((variant, index) => (
                      <TableRow key={variant.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{getVariantOptionLabel(variant) || 'Variant SKU'}</Typography>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={variant.price}
                            onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                            disabled={!canManageVariants}
                            inputProps={{ min: 0, step: '0.01' }}
                            sx={{ width: 120 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            type="number"
                            value={variant.stockQty}
                            onChange={(e) => handleVariantChange(index, 'stockQty', e.target.value)}
                            disabled={!canManageVariants}
                            inputProps={{ min: 0 }}
                            sx={{ width: 100 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={variant.sku || ''}
                            onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                            disabled={!canManageVariants}
                            placeholder="Optional SKU"
                            sx={{ width: 160 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button size="small" variant={variant.isActive === false ? 'outlined' : 'contained'} onClick={() => handleVariantChange(index, 'isActive', variant.isActive === false)} disabled={!canManageVariants}>
                            {variant.isActive === false ? 'Inactive' : 'Active'}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => handleDeleteVariant(variant.id)} disabled={!canManageVariants}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Clone Variants from Another Product</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Option combinations and prices will be copied. Stock stays reset so you can review the new product inventory safely.
          </Typography>
          <Tabs value={cloneTab} onChange={(_, value) => { setCloneTab(value); setCloneSelectedProduct(null); setCloneCatSelectedProduct(null); }} sx={{ mb: 2 }}>
            <Tab label="Search by Product Name" />
            <Tab label="Browse by Category" />
          </Tabs>

          {cloneTab === 0 && (
            <Autocomplete
              options={cloneSearchResults}
              getOptionLabel={(option) => option.name || ''}
              filterOptions={(x) => x}
              loading={cloneSearchLoading}
              value={cloneSelectedProduct}
              onChange={(_, value) => setCloneSelectedProduct(value)}
              inputValue={cloneSearchInput}
              onInputChange={(_, value, reason) => { if (reason !== 'reset') handleCloneSearchChange(value); }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search products"
                  placeholder="Type product name..."
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {cloneSearchLoading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              noOptionsText={cloneSearchInput.length > 0 ? 'No products found' : 'Start typing to search'}
            />
          )}

          {cloneTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Category</InputLabel>
                <Select label="Select Category" value={cloneCatId} onChange={(e) => handleCloneCatChange(e.target.value)}>
                  <MenuItem value=""><em>Select category</em></MenuItem>
                  {flatCatFiles.map((category) => (
                    <MenuItem key={category.id} value={category.id} sx={{ pl: 2 + category.depth * 2 }}>
                      {category.path}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {cloneCatId && (
                cloneCatProductsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Loading products...</Typography>
                  </Box>
                ) : cloneCatProducts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No other products in this category.</Typography>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Product</InputLabel>
                    <Select label="Select Product" value={cloneCatSelectedProduct?.id || ''} onChange={(e) => setCloneCatSelectedProduct(cloneCatProducts.find((product) => product.id === e.target.value) || null)}>
                      <MenuItem value=""><em>Select product</em></MenuItem>
                      {cloneCatProducts.map((product) => (
                        <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )
              )}
            </Box>
          )}

          {(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Will clone variants from: <strong>{(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct)?.name}</strong>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCloneOpen(false);
            setCloneSelectedProduct(null);
            setCloneSearchInput('');
            setCloneSearchResults([]);
            setCloneCatSelectedProduct(null);
            setCloneCatId('');
            setCloneCatProducts([]);
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleClone} disabled={cloning || !(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct)}>
            {cloning ? 'Cloning...' : 'Clone Variants'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProductEditPage;

