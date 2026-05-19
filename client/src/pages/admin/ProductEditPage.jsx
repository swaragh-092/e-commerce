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
import { formatOpenEndedDateRange } from '../../utils/dates';
import ProductCustomTabs from '../../components/admin/ProductCustomTabs';
import ProductComboBuilder from '../../components/admin/ProductComboBuilder';
import TaxConfigSection from '../../components/admin/ProductTaxConfig';
import VariantsPanel from '../../components/admin/ProductVariantsPanel';
import { toDateTimeLocal } from '../../utils/dates';
import { generateSlug } from '../../utils/strings';
import { walkCategoryTree } from '../../utils/categories';
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

      if (payload.type === 'simple') {
        payload.quantity = parseInt(formData.quantity) || 0;
      }
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
  const flatCatFiles = walkCategoryTree(categories, (category, { depth, path }) => ({
    ...category,
    depth,
    path,
  }));

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
                          const scheduleLabel = selected
                            ? formatOpenEndedDateRange(selected.startDate, selected.endDate)
                            : '';
                          if (scheduleLabel) {
                            return (
                              <Typography component="div" variant="caption" color="primary.main" fontWeight={700} display="block">
                                Global schedule: {scheduleLabel}
                              </Typography>
                            );
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


export default ProductEditPage;
