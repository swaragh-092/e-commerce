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
  LinearProgress,
} from '@mui/material';

import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  ElectricBolt as ElectricBoltIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandMore as ExpandMoreIcon,
  Image as ImageIcon,
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
import MediaPicker from '../../components/common/MediaPicker';
import { useNotification } from '../../context/NotificationContext';
import { useCurrency, useSettings, useFeature } from '../../hooks/useSettings';
import { getProductBasePrice } from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import { formatAttributeValue, getSwatchColor } from '../../utils/attributePresentation';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';
import ProductCustomTabs from '../../components/admin/ProductCustomTabs';
import ProductComboBuilder from '../../components/admin/ProductComboBuilder';

const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

  // Only validate price/tax if their respective features are enabled
  const pricingEnabled = window.__APP_FEATURES__?.pricing ?? true; // Fallback to true if unknown
  const showPrice = window.__APP_FEATURES__?.showPrice ?? true;

  if (pricingEnabled || showPrice) {
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

    if ((formData.saleStartAt || formData.saleEndAt) && (formData.salePrice === '' || formData.salePrice === null)) {
      errs.salePrice = 'Add a sale price before scheduling a sale.';
    }

    if (formData.saleStartAt && formData.saleEndAt && new Date(formData.saleEndAt) <= new Date(formData.saleStartAt)) {
      errs.saleEndAt = 'Sale end must be after the start date.';
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

  if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
    errs.slug = 'Slug can only contain lowercase letters, numbers, and hyphens.';
  } else if (formData.slug && formData.slug.length > 255) {
    errs.slug = 'Slug must be 255 characters or less.';
  }

  // Tax Configuration Validation
  if (pricingEnabled && formData.taxConfig?.isCustom) {
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
  if (isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

const getAttributeRowName = (row) => (
  row?.attribute?.name || row?.customName || 'Attribute'
);

const getAttributeRowValue = (row) => (
  row?.value?.displayLabel
  || row?.value?.value
  || row?.customValue
  || 'Default'
);

const ProductEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { notify, confirm } = useNotification();
  const { settings } = useSettings();
  const { currency, symbol, formatPrice } = useCurrency();
  const { hasPermission } = useAuth();
  const isNew = !id || id === 'new';
  const { generateProductSKU, generateVariantSKU } = useSKUGenerator();
  const sales = settings?.sales || {};
  const canCreateProducts = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProducts = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canUploadMedia = hasPermission(PERMISSIONS.MEDIA_UPLOAD);
  const pricingEnabled = useFeature('pricing');
  const showPrice = useFeature('showPrice');
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
    type: 'simple',
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
    // SEO Fields
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    ogImage: '',
  });
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saleLabels, setSaleLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [ogPickerOpen, setOgPickerOpen] = useState(false);
  const [dbProduct, setDbProduct] = useState(null); 
  const [hasVariants, setHasVariants] = useState(false);
  const [variantStockTotal, setVariantStockTotal] = useState(0);
  const [globalPrimaryVersion, setGlobalPrimaryVersion] = useState(0);

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

            setDbProduct(p);

            const activeVariants = Array.isArray(p.variants) ? p.variants.filter((variant) => variant?.isActive !== false) : [];
            const nextHasVariants = activeVariants.length > 0;
            const nextVariantStockTotal = activeVariants.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
            setHasVariants(nextHasVariants);
            setVariantStockTotal(nextVariantStockTotal);

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
              quantity: nextHasVariants ? nextVariantStockTotal : (p.quantity || 0),
              status: p.status || 'draft',
              type: p.type || 'simple',
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
              // SEO Fields
              metaTitle: p.metaTitle || '',
              metaDescription: p.metaDescription || '',
              metaKeywords: p.metaKeywords || '',
              ogImage: p.ogImage || '',
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

  const handleVariantStockChange = useCallback((total, count, fallbackQuantity) => {
    setVariantStockTotal(total);
    setHasVariants(count > 0);
    if (count > 0) {
      setFormData((prev) => ({ ...prev, quantity: total }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    } else if (fallbackQuantity !== undefined) {
      setFormData((prev) => ({ ...prev, quantity: fallbackQuantity }));
    }
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSaveProduct) {
      notify(`You do not have permission to ${isNew ? 'create' : 'update'} products.`, 'error');
      return;
    }

    const effectiveQuantity = hasVariants ? variantStockTotal : formData.quantity;
    const errs = validate({ ...formData, quantity: effectiveQuantity, _features: { pricing: pricingEnabled, showPrice } });

    // Block type change if invariants are violated
    if (!isNew && dbProduct && formData.type !== dbProduct.type) {
        if (formData.type === 'combo' && dbProduct.variants?.length > 0) {
            errs.type = 'Cannot change to Combo type: this product has existing variants. Delete them first.';
        }
        if (formData.type !== 'combo' && dbProduct.comboItems?.length > 0) {
            errs.type = `Cannot change to ${formData.type} type: this product has combo items. Clear the bundle first.`;
        }
    }


    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (errs.type) notify(errs.type, 'error');
      else notify('Please fix the validation errors before saving.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        salePrice:
          formData.salePrice !== '' && formData.salePrice !== null && !isNaN(parseFloat(formData.salePrice))
            ? parseFloat(formData.salePrice)
            : null,
        saleStartAt: (formData.salePrice !== '' && formData.salePrice !== null) ? toIsoOrNull(formData.saleStartAt) : null,
        saleEndAt: (formData.salePrice !== '' && formData.salePrice !== null) ? toIsoOrNull(formData.saleEndAt) : null,
        saleLabel: (formData.salePrice !== '' && formData.salePrice !== null) ? (formData.saleLabel || null) : null,
        brandId: formData.brandId || null,
        quantity: formData.type === 'combo' ? 0 : (parseInt(formData.quantity) || 0),
        type: formData.type || 'simple',
        // Shipping dimensions — null when blank so DB stores NULL cleanly
        requiresShipping: formData.requiresShipping,
        weightGrams: formData.weightGrams !== '' ? parseInt(formData.weightGrams, 10) : null,
        lengthCm:    formData.lengthCm    !== '' ? parseInt(formData.lengthCm, 10)    : null,
        breadthCm:   formData.breadthCm   !== '' ? parseInt(formData.breadthCm, 10)   : null,
        heightCm:    formData.heightCm    !== '' ? parseInt(formData.heightCm, 10)    : null,
        // SEO Fields
        metaTitle: formData.metaTitle || null,
        metaDescription: formData.metaDescription || null,
        metaKeywords: formData.metaKeywords || null,
        ogImage: formData.ogImage || null,
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
        const res = await updateProduct(id, payload);
        if (res?.data) setDbProduct(res.data);
        notify('Product updated successfully.', 'success');
      }
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };


  const handleMediaSelect = (selectedMedia) => {
    if (!selectedMedia) return;
    const mediaArray = Array.isArray(selectedMedia) ? selectedMedia : [selectedMedia];
    
    setFormData((prev) => {
      const existingIds = new Set(prev.images.map(img => img.mediaId));
      const filteredNew = mediaArray.filter(m => !existingIds.has(m.id));
      
      return {
        ...prev,
        images: [
          ...prev.images,
          ...filteredNew.map((media, index) => ({
            url: media.url,
            mediaId: media.id,
            alt: media.originalName || 'Product Image',
            isPrimary: prev.images.length === 0 && index === 0,
          })),
        ],
      };
    });
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
    setGlobalPrimaryVersion((current) => current + 1);
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

            {(pricingEnabled || showPrice) && (
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
                      InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
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
                      InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
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
                        {(() => {
                          const selected = saleLabels.find(l => l.id === formData.saleLabel);
                          if (selected && (selected.startDate || selected.endDate)) {
                            const start = selected.startDate ? new Date(selected.startDate) : null;
                            const end = selected.endDate ? new Date(selected.endDate) : null;
                            const isValidStart = start && !isNaN(start.getTime());
                            const isValidEnd = end && !isNaN(end.getTime());

                            if (isValidStart || isValidEnd) {
                              return (
                                <Typography component="div" variant="caption" color="primary.main" fontWeight={700} display="block">
                                  Global schedule: {isValidStart ? start.toLocaleDateString() : 'Now'} - {isValidEnd ? end.toLocaleDateString() : 'Indefinite'}
                                </Typography>
                              );
                            }
                          }
                          return null;
                        })()}
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
            )}

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Media / Images
              </Typography>
              {canUploadMedia ? (
                <Box>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => setMediaPickerOpen(true)}
                    sx={{
                      py: 3,
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      borderRadius: 2,
                      '&:hover': {
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    Add Product Media
                  </Button>
                  <MediaPicker
                    open={mediaPickerOpen}
                    onClose={() => setMediaPickerOpen(false)}
                    onSelect={handleMediaSelect}
                    multiple={true}
                    title="Select Product Images"
                  />
                </Box>
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

            {pricingEnabled && (
              <Paper sx={{ p: 3, mb: 3, mt: 3 }}>
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
            )}
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

              <FormControl fullWidth margin="normal" error={Boolean(errors.type)}>
                <InputLabel>Product Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Product Type"
                  onChange={async (e) => {
                    const newType = e.target.value;
                    if (newType === 'combo' && formData.type !== 'combo') {
                        const ok = await confirm(
                            'Switch to Combo Product?',
                            'Changing to a Combo will clear the current stock quantity and SKU, as inventory will be managed via constituents. Existing variants will also be ignored. Continue?',
                            'warning'
                        );
                        if (!ok) return;
                        // Clear inventory fields for combo
                        setFormData(prev => ({ ...prev, type: newType, quantity: 0, sku: '' }));
                    } else {
                        setField('type', newType);
                    }
                  }}
                >
                  <MenuItem value="simple">Simple Product</MenuItem>
                  <MenuItem value="variable">Variable Product</MenuItem>
                  <MenuItem value="combo">Combo / Bundle</MenuItem>
                </Select>
                {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
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
            
            {pricingEnabled && (
              <TaxConfigSection 
                taxConfig={formData.taxConfig} 
                basePrice={formData.price}
                setTaxConfig={(val) => setField('taxConfig', val)}
                globalSettings={settings?.checkout || {}}
                formatPrice={formatPrice}
                disabled={!canSaveProduct}
              />
            )}

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


            {formData.type !== 'combo' && (
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
            )}

            {/* Combo Builder — only after the product type is saved as combo */}
            {!isNew && formData.type === 'combo' && dbProduct?.type !== 'combo' && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Save the product as a combo before adding bundle items.
              </Alert>
            )}

            {!isNew && formData.type === 'combo' && dbProduct?.type === 'combo' && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <ProductComboBuilder 
                  productId={id} 
                  canEdit={canUpdateProducts}
                  onSuggestedPrice={(price) => setField('price', price)}
                />
              </Paper>
            )}


            

            {settings?.features?.seo !== false && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6">
                    SEO Configuration
                  </Typography>
                  <Chip label="SEO v2" size="small" color="primary" variant="outlined" />
                </Box>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Fine-tune how this product appears in search engines and social media. 
                  If left blank, the system will auto-generate metadata.
                </Alert>
                
                <TextField
                  fullWidth
                  label="Meta Title"
                  margin="normal"
                  size="small"
                  value={formData.metaTitle}
                  onChange={(e) => setField('metaTitle', e.target.value)}
                  placeholder={formData.name}
                  helperText="Appears as the clickable headline in search results."
                />
                <TextField
                  fullWidth
                  label="Meta Description"
                  margin="normal"
                  size="small"
                  multiline
                  rows={3}
                  value={formData.metaDescription}
                  onChange={(e) => setField('metaDescription', e.target.value)}
                  placeholder={formData.shortDescription}
                  helperText="A brief summary (150-160 chars) to entice clicks."
                />
                <TextField
                  fullWidth
                  label="Internal Keywords"
                  margin="normal"
                  size="small"
                  value={formData.metaKeywords}
                  onChange={(e) => setField('metaKeywords', e.target.value)}
                  helperText="Used for internal search optimization. Separate with commas."
                />
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Social Sharing Image (OG Image)</Typography>
                  {canUploadMedia && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setOgPickerOpen(true)}
                        startIcon={<ImageIcon />}
                      >
                        Select from Media Library
                      </Button>
                      <MediaPicker
                        open={ogPickerOpen}
                        onClose={() => setOgPickerOpen(false)}
                        onSelect={(selected) => {
                          const media = Array.isArray(selected) ? selected[0] : selected;
                          if (media?.url) setField('ogImage', media.url);
                          setOgPickerOpen(false);
                        }}
                        multiple={false}
                        title="Select OG Image"
                      />
                    </>
                  )}
                  {formData.ogImage && (
                    <Box sx={{ mt: 2, position: 'relative', width: 'fit-content' }}>
                      <img 
                        src={getMediaUrl(formData.ogImage)} 
                        alt="SEO Preview" 
                        style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #ddd' }} 
                      />
                      {canSaveProduct && (
                        <IconButton 
                          size="small" 
                          color="error" 
                          sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper', boxShadow: 1 }}
                          onClick={() => setField('ogImage', '')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  )}
                  {!canUploadMedia && !formData.ogImage && (
                    <Typography variant="caption" color="text.secondary">
                      You do not have permission to upload media.
                    </Typography>
                  )}
                  <FormHelperText>Recommended size: 1200x630px</FormHelperText>
                </Box>

                <Box sx={{ mt: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                    GOOGLE SEARCH PREVIEW
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#1a0dab', fontSize: '18px', '&:hover': { textDecoration: 'underline' }, cursor: 'pointer', mb: 0.5 }}>
                    {formData.metaTitle || formData.name || 'Product Name'} {settings?.seo?.titleSuffix || ' | My Store'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#006621', fontSize: '14px', mb: 0.5 }}>
                    {window.location.origin}/product/{formData.slug || 'slug'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#545454', fontSize: '13px', lineHeight: 1.4 }}>
                    {formData.metaDescription || formData.shortDescription || 'Your product description will appear here...'}
                  </Typography>
                </Box>
              </Paper>
            )}
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
      {/* Variants panel — only visible once the product has been saved and has a real ID and is NOT a combo */}
      {!isNew && formData.type !== 'combo' && (
        <VariantsPanel 
          productId={id} 
          productName={formData.name}
          productSku={formData.sku}
          categoryIds={formData.categoryIds} 
          flatCatFiles={flatCatFiles} 
          canManageVariants={canUpdateProducts} 
          onStockTotalChange={handleVariantStockChange}
          globalPrimaryVersion={globalPrimaryVersion}
          onVariantPrimarySelected={() => setFormData((prev) => ({
            ...prev,
            images: prev.images.map((img) => ({ ...img, isPrimary: false })),
          }))}
        />
      )}

      {/* Custom Tabs panel — only after product is saved */}
      {!isNew && (
        <ProductCustomTabs
          productId={id}
          canEdit={canUpdateProducts}
        />
      )}
    </Box>
  );
};

/* ─── Tax Configuration Section ────────────────────────────────────────────── */
const TaxConfigSection = ({ taxConfig, basePrice, setTaxConfig, globalSettings, formatPrice, disabled }) => {
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
            <Typography variant="body2" fontWeight={500}>{formatPrice(currentPrice)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">Tax (Estimated):</Typography>
            <Typography variant="body2" fontWeight={500}>+ {formatPrice(taxTotal)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="subtitle2">Total:</Typography>
            <Typography variant="subtitle2" color="primary.main">{formatPrice(currentPrice + taxTotal)}</Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
};


/* ─── Variants Panel ──────────────────────────────────────────────────────── */
const VariantsPanel = ({
  productId,
  productName,
  productSku,
  categoryIds = [],
  flatCatFiles = [],
  canManageVariants = false,
  onStockTotalChange,
  globalPrimaryVersion = 0,
  onVariantPrimarySelected,
}) => {
  const { notify, confirm } = useNotification();
  const { generateProductSKU, generateVariantSKU } = useSKUGenerator();
  const [productAttributes, setProductAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [productBasePrice, setProductBasePrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [variantMediaPickerOpen, setVariantMediaPickerOpen] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [selectedValueIds, setSelectedValueIds] = useState([]);
  const [colorDraft, setColorDraft] = useState({ label: '', hex: '#38bdf8' });
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
  const [suggestedAttributes, setSuggestedAttributes] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
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
      const activeVariantRows = varData.filter((variant) => variant?.isActive !== false);
      const stockTotal = activeVariantRows.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
      setProductAttributes(attrRows);
      setVariants(varData.map((variant) => ({
        ...variant,
        mediaId: variant.mediaId || variant.media_id, // Handle both cases
        images: Array.isArray(variant.images) ? variant.images : [],
        price: variant.price ?? product?.effectivePrice ?? product?.price ?? 0,
        stockQty: variant.stockQty ?? 0,
        _dirty: false,
      })));
      setAttributes(attrData);
      setProductBasePrice(getProductBasePrice(product));
      onStockTotalChange?.(stockTotal, activeVariantRows.length, Number(product?.quantity || 0));

      // Load suggested attributes from categories
      if (categoryIds.length > 0) {
        setSuggestedLoading(true);
        attributeService.getCategoryAttributes(categoryIds, true)
          .then(res => {
            const catAttrs = res?.data?.data || [];
            // Filter out attributes already assigned to the product
            const existingIds = new Set(attrRows.map(r => r.attributeId));
            setSuggestedAttributes(catAttrs.filter(a => !existingIds.has(a.id)));
          })
          .catch(err => console.error('Failed to load suggested attributes', err))
          .finally(() => setSuggestedLoading(false));
      }
    } catch (error) {
      notify('Failed to load product options.', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, categoryIds, notify, onStockTotalChange]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const activeVariantRows = variants.filter((variant) => variant?.isActive !== false);
    const stockTotal = activeVariantRows.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
    onStockTotalChange?.(stockTotal, activeVariantRows.length);
  }, [variants, onStockTotalChange]);

  useEffect(() => {
    if (!globalPrimaryVersion) return;
    setVariants((current) => current.map((variant) => (
      (variant.images || []).some((img) => img.isPrimary)
        ? {
            ...variant,
            images: variant.images.map((img) => ({ ...img, isPrimary: false })),
            _dirty: true,
          }
        : variant
    )));
  }, [globalPrimaryVersion]);

  const handleVariantMediaSelect = (selectedMedia) => {
    if (!selectedMedia || variantMediaPickerOpen === null) return;
    const targetIndex = variantMediaPickerOpen;
    const mediaItems = Array.isArray(selectedMedia) ? selectedMedia : [selectedMedia];
    setVariants((current) => current.map((variant, i) => {
      if (i !== targetIndex) return variant;
      const currentImages = Array.isArray(variant.images) ? variant.images : [];
      const existingIds = new Set(currentImages.map((img) => img.mediaId || img.media_id).filter(Boolean));
      const newImages = mediaItems
        .filter((media) => media?.id && !existingIds.has(media.id))
        .map((media, offset) => ({
          url: media.url,
          mediaId: media.id,
          alt: media.originalName || getVariantOptionLabel(variant) || 'Variant image',
          sortOrder: currentImages.length + offset,
          isPrimary: false,
        }));
      const nextImages = [...currentImages, ...newImages];
      const representative = nextImages.find((img) => img.isPrimary) || nextImages[0] || null;
      return {
        ...variant,
        images: nextImages,
        mediaId: representative?.mediaId || null,
        media: representative?.media || mediaItems.find((media) => media.id === representative?.mediaId) || variant.media,
        _dirty: true,
      };
    }));
    setVariantMediaPickerOpen(null);
  };

  const handleRemoveVariantImage = (variantIndex, imageIndex) => {
    if (!canManageVariants) return;
    setVariants((current) => current.map((variant, i) => {
      if (i !== variantIndex) return variant;
      const nextImages = (variant.images || []).filter((_, idx) => idx !== imageIndex)
        .map((img, idx) => ({ ...img, sortOrder: idx }));
      const representative = nextImages.find((img) => img.isPrimary) || nextImages[0] || null;
      return {
        ...variant,
        images: nextImages,
        mediaId: representative?.mediaId || null,
        _dirty: true,
      };
    }));
  };

  const handleSetVariantPrimaryImage = (variantIndex, imageIndex) => {
    if (!canManageVariants) return;
    setVariants((current) => current.map((variant, i) => ({
      ...variant,
      images: (variant.images || []).map((img, idx) => ({
        ...img,
        isPrimary: i === variantIndex && idx === imageIndex,
      })),
      mediaId: i === variantIndex
        ? (variant.images || [])[imageIndex]?.mediaId || variant.mediaId || null
        : variant.mediaId,
      _dirty: i === variantIndex || (variant.images || []).some((img) => img.isPrimary),
    })));
    onVariantPrimarySelected?.();
  };

  const selectedTemplateRecord = attributes.find((attribute) => attribute.id === selectedTemplate);
  const selectedTemplateText = `${selectedTemplateRecord?.name || ''} ${selectedTemplateRecord?.slug || ''}`.toLowerCase();
  const isColorAttribute = selectedTemplateRecord?.valueType === 'color' || /colou?r|shade/.test(selectedTemplateText);
  const isValidHexColor = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(colorDraft.hex);
  const variantAttributeRows = productAttributes.filter((row) => row.isVariantAttr);
  const canGenerateMatrix = variantAttributeRows.some((row) => row.attributeId) && variantAttributeRows.length > 0;
  const hasVariantChanges = variants.some((variant) => variant._dirty);

  const renderValueSwatch = (valueRecord, size = 18) => {
    if (!valueRecord) return null;
    const color = getSwatchColor(valueRecord);
    if (valueRecord?.imageUrl) {
      return (
        <Box
          component="img"
          src={valueRecord.imageUrl}
          alt=""
          sx={{ width: size, height: size, borderRadius: 0.75, objectFit: 'cover', flexShrink: 0 }}
        />
      );
    }
    if (!color) return null;
    return (
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: color,
          border: '1px solid',
          borderColor: color === '#ffffff' ? 'divider' : 'transparent',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
          flexShrink: 0,
        }}
      />
    );
  };

  const renderValueLabel = (valueRecord, attributeRecord = selectedTemplateRecord) => (
    formatAttributeValue(valueRecord || {}, attributeRecord || {}) || valueRecord?.value || ''
  );

  const handleCreateColorValue = async () => {
    if (!canManageVariants || !selectedTemplate || !colorDraft.label.trim() || !isValidHexColor) return;

    try {
      const response = await attributeService.addAttributeValue(selectedTemplate, {
        value: colorDraft.label.trim(),
        displayLabel: colorDraft.label.trim(),
        swatchColor: colorDraft.hex,
      });
      const createdValue = response?.data?.data || response?.data;
      if (createdValue?.id) {
        setAttributes((current) => current.map((attribute) => (
          attribute.id === selectedTemplate
            ? { ...attribute, values: [...(attribute.values || []), createdValue] }
            : attribute
        )));
        setSelectedValueIds((current) => [...new Set([...current, createdValue.id])]);
        setColorDraft({ label: '', hex: '#38bdf8' });
        notify('Color value created and selected.', 'success');
      }
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to create color value.'), 'error');
    }
  };

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
    const dirtyVariants = variants.filter((variant) => variant._dirty);
    setSaving(true);
    setSaveProgress({ current: 0, total: dirtyVariants.length });
    
    try {
      let count = 0;
      for (const variant of dirtyVariants) {
        await attributeService.updateProductVariant(productId, variant.id, {
          sku: variant.sku?.trim() || null,
          price: Number(variant.price || 0),
          stockQty: Number(variant.stockQty || 0),
          isActive: variant.isActive !== false,
          sortOrder: Number(variant.sortOrder || 0),
          mediaId: variant.mediaId || null,
          images: (variant.images || []).map((img, index) => ({
            url: img.url,
            alt: img.alt || null,
            mediaId: img.mediaId || img.media_id || img.media?.id || null,
            sortOrder: Number(img.sortOrder ?? index),
            isPrimary: Boolean(img.isPrimary),
          })),
        });
        count++;
        setSaveProgress(prev => ({ ...prev, current: count }));
      }
      notify('Variants updated.', 'success');
      loadAll();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save variants.', 'error');
    } finally {
      setSaving(false);
      setSaveProgress({ current: 0, total: 0 });
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

            {suggestedAttributes.length > 0 && (
              <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.100' }}>
                <Typography variant="subtitle2" color="primary.700" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ElectricBoltIcon fontSize="small" /> Suggested from Categories
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  These attributes are linked to your selected categories. Click to add them.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {suggestedAttributes.map((attr) => (
                    <Chip
                      key={attr.id}
                      label={attr.name}
                      size="small"
                      icon={<AddIcon />}
                      onClick={() => {
                        setSelectedTemplate(attr.id);
                        setAttributeTab(1);
                        setSelectedValueIds([]);
                      }}
                      sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'primary.100' } }}
                    />
                  ))}
                </Box>
              </Box>
            )}

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
                      setColorDraft({ label: '', hex: '#38bdf8' });
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
                          return (
                            <Chip
                              key={valueId}
                              size="small"
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                  {renderValueSwatch(valueRecord, 14)}
                                  <span>{valueRecord ? renderValueLabel(valueRecord) : valueId}</span>
                                </Box>
                              }
                              sx={{ '& .MuiChip-label': { px: 0.75 } }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {(selectedTemplateRecord?.values || []).map((value) => (
                      <MenuItem key={value.id} value={value.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {renderValueSwatch(value)}
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{renderValueLabel(value)}</Typography>
                            {value.swatchColor && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {value.swatchColor}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {isColorAttribute && (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      borderColor: 'primary.main',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 0.5 }}>
                      Create exact color
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                      Pick the exact hex color and label it the way customers should see it, like Sky Blue or Apple Red.
                    </Typography>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '44px 1fr 120px' },
                        gap: 1,
                        alignItems: 'center',
                      }}
                    >
                      <TextField
                        type="color"
                        size="small"
                        value={isValidHexColor ? colorDraft.hex : '#000000'}
                        onChange={(e) => setColorDraft((current) => ({ ...current, hex: e.target.value }))}
                        disabled={!canManageVariants}
                        inputProps={{ 'aria-label': 'Pick exact color' }}
                        sx={{
                          '& input': {
                            p: 0.5,
                            height: 34,
                            cursor: 'pointer',
                          },
                        }}
                      />
                      <TextField
                        size="small"
                        label="Customer label"
                        placeholder="Sky Blue, Apple Red..."
                        value={colorDraft.label}
                        onChange={(e) => setColorDraft((current) => ({ ...current, label: e.target.value }))}
                        disabled={!canManageVariants}
                      />
                      <TextField
                        size="small"
                        label="Hex"
                        value={colorDraft.hex}
                        onChange={(e) => setColorDraft((current) => ({ ...current, hex: e.target.value }))}
                        error={Boolean(colorDraft.hex) && !isValidHexColor}
                        disabled={!canManageVariants}
                        inputProps={{ style: { fontFamily: 'monospace' } }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            bgcolor: isValidHexColor ? colorDraft.hex : 'transparent',
                            border: '1px solid',
                            borderColor: 'divider',
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" noWrap>
                          Preview: {colorDraft.label || 'Color label'} {isValidHexColor ? colorDraft.hex : ''}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleCreateColorValue}
                        disabled={!canManageVariants || !selectedTemplate || !colorDraft.label.trim() || !isValidHexColor}
                      >
                        Create & Select
                      </Button>
                    </Box>
                  </Paper>
                )}

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
                    const label = getAttributeRowName(row);
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
                        const value = row.value ? renderValueLabel(row.value, row.attribute) : row.customValue;
                        return (
                          <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {renderValueSwatch(row.value)}
                                  <Typography variant="body2" color="text.secondary" fontWeight={700}>{value}</Typography>
                                </Box>
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
                <Chip
                  size="small"
                  variant="outlined"
                  color="success"
                  label={`Total stock: ${variants.filter((variant) => variant?.isActive !== false).reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0)}`}
                />
                <Button variant="outlined" size="small" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => setCloneOpen(true)} disabled={!canManageVariants}>
                  Clone from Product
                </Button>
                <Button variant="outlined" size="small" onClick={handleGenerateVariants} disabled={!canManageVariants || !canGenerateMatrix}>
                  Generate Matrix
                </Button>
                <Button variant="contained" size="small" onClick={handleSaveVariants} disabled={!canManageVariants || !hasVariantChanges || saving}>
                  {saving ? `Saving (${saveProgress.current}/${saveProgress.total})...` : 'Save Variant Changes'}
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
                <Chip key={row.id} size="small" color="primary" label={`${getAttributeRowName(row)}: ${getAttributeRowValue(row)}`} />
              ))}
            </Box>

            {saving && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={(saveProgress.current / saveProgress.total) * 100} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Saving {saveProgress.current} of {saveProgress.total} variants...
                </Typography>
              </Box>
            )}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : variants.length === 0 ? (

              <Alert severity="info">
                No variants yet. Add product attributes and mark the SKU-defining ones first, then click <strong>Generate Matrix</strong>.
              </Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {variants.map((variant, index) => (
                  <Accordion key={variant.id} variant="outlined" sx={{ m: '0 !important' }}>
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        '& .MuiAccordionSummary-content': {
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mr: 1
                        }
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {getVariantOptionLabel(variant) || 'Variant SKU'}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVariant(variant.id);
                        }}
                        disabled={!canManageVariants}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(variant.images || []).map((img, imageIndex) => (
                              <Box
                                key={img.id || img.mediaId || imageIndex}
                                sx={{
                                  position: 'relative',
                                  width: 64,
                                  height: 64,
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  border: '2px solid',
                                  borderColor: img.isPrimary ? 'primary.main' : 'divider',
                                  '&:hover .variant-image-actions': { opacity: 1 },
                                }}
                              >
                                <img
                                  src={getMediaUrl(img.url || img.media?.url)}
                                  alt={img.alt || 'Variant'}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <Box
                                  className="variant-image-actions"
                                  sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    bgcolor: 'rgba(0,0,0,0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 0.5,
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                  }}
                                >
                                  <Tooltip title={img.isPrimary ? 'Primary image' : 'Set as primary'}>
                                    <IconButton
                                      size="small"
                                      sx={{ bgcolor: 'background.paper' }}
                                      color={img.isPrimary ? 'warning' : 'default'}
                                      onClick={() => handleSetVariantPrimaryImage(index, imageIndex)}
                                      disabled={!canManageVariants}
                                    >
                                      {img.isPrimary ? <StarIcon sx={{ fontSize: 16 }} /> : <StarBorderIcon sx={{ fontSize: 16 }} />}
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Remove image">
                                    <IconButton
                                      size="small"
                                      sx={{ bgcolor: 'background.paper' }}
                                      color="error"
                                      onClick={() => handleRemoveVariantImage(index, imageIndex)}
                                      disabled={!canManageVariants}
                                    >
                                      <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                {img.isPrimary && (
                                  <Chip
                                    size="small"
                                    label="Primary"
                                    color="primary"
                                    sx={{
                                      position: 'absolute',
                                      left: 4,
                                      bottom: 4,
                                      height: 18,
                                      fontSize: 10,
                                      '& .MuiChip-label': { px: 0.6 },
                                    }}
                                  />
                                )}
                              </Box>
                            ))}
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ImageIcon />}
                              onClick={() => setVariantMediaPickerOpen(index)}
                              disabled={!canManageVariants}
                              sx={{ height: 64, borderStyle: 'dashed' }}
                            >
                              Add Images
                            </Button>
                          </Box>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Price"
                            type="number"
                            value={variant.price}
                            onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                            disabled={!canManageVariants}
                            inputProps={{ min: 0, step: '0.01' }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Stock Qty"
                            type="number"
                            value={variant.stockQty}
                            onChange={(e) => handleVariantChange(index, 'stockQty', e.target.value)}
                            disabled={!canManageVariants}
                            inputProps={{ min: 0 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4.5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="SKU"
                            value={variant.sku || ''}
                            onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                            disabled={!canManageVariants}
                            placeholder="Optional SKU"
                            InputProps={{
                              endAdornment: (
                                <InputAdornment position="end">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => {
                                      const baseSku = productSku || generateProductSKU(productName);
                                      const generatedSku = generateVariantSKU(baseSku, null, getVariantOptionLabel(variant));
                                      handleVariantChange(index, 'sku', generatedSku);
                                    }}
                                    title="Auto-generate variant SKU"
                                  >
                                    <ElectricBoltIcon fontSize="small" />
                                  </IconButton>
                                </InputAdornment>
                              )
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={2} sx={{ display: 'flex', alignItems: 'center' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={variant.isActive !== false}
                                onChange={(e) => handleVariantChange(index, 'isActive', e.target.checked)}
                                disabled={!canManageVariants}
                                color="success"
                              />
                            }
                            label={
                              <Typography variant="caption" color={variant.isActive !== false ? 'success.main' : 'text.disabled'}>
                                {variant.isActive !== false ? 'Active' : 'Inactive'}
                              </Typography>
                            }
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <MediaPicker
        open={variantMediaPickerOpen !== null}
        onClose={() => setVariantMediaPickerOpen(null)}
        onSelect={handleVariantMediaSelect}
        multiple={true}
        title="Select Variant Images"
      />

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
