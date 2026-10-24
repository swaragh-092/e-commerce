import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Paper,
  FormControl, InputLabel, Select, MenuItem, Chip,
  CircularProgress, Tooltip, IconButton, Alert,
  InputAdornment, Autocomplete, Tabs, Tab,
  FormControlLabel, Accordion, AccordionSummary, AccordionDetails,
  Switch, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
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
import { getProductById, getProducts } from '../../services/productService';
import attributeService from '../../services/attributeService';
import MediaPicker from '../common/MediaPicker';
import { useNotification } from '../../context/NotificationContext';
import { getProductBasePrice } from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import ProductAttributesSection from './ProductAttributesSection';
import VariantSetup from './VariantSetup';
import VariantPriceGroups from './VariantPriceGroups';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../utils/apiErrors';

const EMPTY_LIST = [];
const validPrice = (value) => value !== '' && value != null && /^\d+(\.\d{0,2})?$/.test(String(value)) && Number(value) <= 99999999.99;
const validStock = (variant) => variant.stockQty !== '' && variant.stockQty != null && Number.isInteger(Number(variant.stockQty))
  && Number(variant.stockQty) >= Number(variant.reservedQty || 0) && Number(variant.stockQty) <= 2147483647;

/* ─── Variants Panel ──────────────────────────────────────────────────────── */
const VariantsPanel = ({
  productId,
  productName,
  productSku,
  categoryIds = EMPTY_LIST,
  flatCatFiles = EMPTY_LIST,
  canManageVariants = false,
  pricingEnabled = true,
  onStockTotalChange,
  globalPrimaryVersion = 0,
  onVariantPrimarySelected,
}) => {
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canManageAttributes = canManageVariants && hasPermission(PERMISSIONS.ATTRIBUTES_MANAGE);
  const [loadError, setLoadError] = useState(false);
  const { generateProductSKU, generateVariantSKU } = useSKUGenerator();
  const [productAttributes, setProductAttributes] = useState([]);
  const [variants, setVariants] = useState([]);
  const [productBasePrice, setProductBasePrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [attributesBusy, setAttributesBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [variantMediaPickerOpen, setVariantMediaPickerOpen] = useState(null);
  const [attributes, setAttributes] = useState([]);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
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
  const cloneSearchTimer = useRef(null);
  const cloneRequests = useRef({ search: 0, category: 0 });
  useEffect(() => () => { clearTimeout(cloneSearchTimer.current); cloneRequests.current.search++; cloneRequests.current.category++; }, []);

  const loadAll = useCallback(async () => {
    if (!productId) { setLoading(false); return; }
    setLoading(true);
    setLoadError(false);
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
      if (!Array.isArray(attrRows) || !Array.isArray(varData) || !Array.isArray(attrData)) throw new Error('Invalid product option data.');
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
        weightGrams: variant.weightGrams ?? '',
        lengthCm: variant.lengthCm ?? '',
        breadthCm: variant.breadthCm ?? '',
        heightCm: variant.heightCm ?? '',
        _dirty: false,
      })));
      setAttributes(attrData);
      setProductBasePrice(getProductBasePrice(product));
      onStockTotalChange?.(stockTotal, activeVariantRows.length, Number(product?.quantity || 0), varData.length);

    } catch (error) {
      setLoadError(true);
      notify('Failed to load product options.', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, notify, onStockTotalChange]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const categoryKey = categoryIds.join(',');
  useEffect(() => {
    if (!categoryKey) { setSuggestedAttributes([]); return; }
    let active = true;
    attributeService.getCategoryAttributes(categoryKey.split(','), true)
      .then((response) => { if (active) setSuggestedAttributes(response?.data?.data || []); })
      .catch(() => { if (active) setSuggestedAttributes([]); });
    return () => { active = false; };
  }, [categoryKey]);


  useEffect(() => {
    const activeVariantRows = variants.filter((variant) => variant?.isActive !== false);
    const stockTotal = activeVariantRows.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
    onStockTotalChange?.(stockTotal, activeVariantRows.length, undefined, variants.length);
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
    if (!canEditVariants) return;
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
    if (!canEditVariants) return;
    setVariants((current) => current.map((variant, i) => {
      if (i !== variantIndex) return variant;
      return {
        ...variant,
        images: (variant.images || []).map((img, idx) => ({
          ...img,
          isPrimary: idx === imageIndex,
        })),
        mediaId: (variant.images || [])[imageIndex]?.mediaId || variant.mediaId || null,
        _dirty: true,
      };
    }));
    onVariantPrimarySelected?.();
  };

  const hasVariantChanges = variants.some((variant) => variant._dirty);
  const skuCounts = variants.reduce((counts, variant) => { const sku = variant.sku?.trim(); if (sku) counts.set(sku, (counts.get(sku) || 0) + 1); return counts; }, new Map());
  const duplicateSku = (variant) => (skuCounts.get(variant.sku?.trim()) || 0) > 1;
  const hasInvalidChanges = variants.some((variant) => variant._dirty && ((pricingEnabled && !validPrice(variant.price)) || !validStock(variant) || duplicateSku(variant)));
  const variantBusy = saving || generating || cloning || deleting;
  const canEditVariants = canManageVariants && !variantBusy && !loading && !loadError;

  const handleVariantChange = (index, field, value) => {
    if (!canEditVariants) return;
    setVariants((current) => current.map((variant, currentIndex) => (
      currentIndex === index ? { ...variant, [field]: value, _dirty: true } : variant
    )));
  };

  const handleSaveVariants = async () => {
    if (!canEditVariants || !hasVariantChanges || hasInvalidChanges || attributesBusy) return;
    const dirtyVariants = variants.filter((variant) => variant._dirty);
    setSaving(true);
    setSaveProgress({ current: 0, total: dirtyVariants.length });
    
    try {
      let count = 0;
      for (const variant of dirtyVariants) {
        await attributeService.updateProductVariant(productId, variant.id, {
          sku: variant.sku?.trim() || null,
          ...(pricingEnabled ? { price: Number(variant.price || 0) } : {}),
          stockQty: Number(variant.stockQty || 0),
          weightGrams: variant.weightGrams !== '' && variant.weightGrams != null ? Number(variant.weightGrams) : null,
          lengthCm: variant.lengthCm !== '' && variant.lengthCm != null ? Number(variant.lengthCm) : null,
          breadthCm: variant.breadthCm !== '' && variant.breadthCm != null ? Number(variant.breadthCm) : null,
          heightCm: variant.heightCm !== '' && variant.heightCm != null ? Number(variant.heightCm) : null,
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
      notify(getApiErrorMessage(err, 'Failed to save variants.'), 'error');
    } finally {
      setSaving(false);
      setSaveProgress({ current: 0, total: 0 });
    }
  };


  const handleDeleteVariant = async (variantId) => {
    if (!canEditVariants || attributesBusy) return;
    const target = variants.find((variant) => variant.id === variantId);
    if (!target) return;
    if (Number(target.reservedQty || 0) > 0) {
      notify(`This variant has ${target.reservedQty} units reserved for active orders. Turn off Available to hide it, or finish/cancel those orders before deleting it.`, 'warning'); return;
    }
    const confirmed = await confirm({
      title: 'Delete variant?',
      message: `Delete ${getVariantOptionLabel(target) || target.sku || 'this variant'}? Its stock will no longer count toward this product.${Number(target.stockQty || 0) > 0 ? ` This removes ${target.stockQty} units from the product’s available stock.` : ''}${target._dirty ? ' Unsaved edits to this variant will be discarded.' : ''} Other variants and attribute values stay unchanged.`,
      confirmText: 'Delete variant', severity: 'error',
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await attributeService.deleteProductVariant(productId, variantId);
      setVariants((current) => current.filter((variant) => variant.id !== variantId));
      const remaining = variants.filter((variant) => variant.id !== variantId && variant.isActive !== false);
      onStockTotalChange?.(remaining.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0), remaining.length, 0);
      notify('Variant deleted.', 'success');
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to delete variant.'), 'error');
    } finally { setDeleting(false); }
  };

  const handleClone = async () => {
    if (!canEditVariants || hasVariantChanges || attributesBusy) return;
    const activeProduct = cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct;
    if (!activeProduct) return;
    setCloning(true);
    try {
      const response = await attributeService.cloneVariants(productId, { sourceProductId: activeProduct.id });
      const summary = response?.data?.meta;
      notify(summary ? `${summary.createdCount} ${summary.createdCount === 1 ? 'variant' : 'variants'} copied; ${summary.skippedCount} already present. New variants have fresh SKUs and zero stock.` : 'Variants copied. Review SKUs, prices and stock below.', summary?.createdCount === 0 ? 'info' : 'success');
      setCloneOpen(false);
      setCloneSelectedProduct(null);
      setCloneSearchInput('');
      setCloneSearchResults([]);
      setCloneCatSelectedProduct(null);
      setCloneCatId('');
      setCloneCatProducts([]);
      clearTimeout(cloneSearchTimer.current);
      cloneRequests.current.search++; cloneRequests.current.category++;
      setCloneSearchLoading(false); setCloneCatProductsLoading(false);
      await loadAll();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Clone failed.'), 'error');
    } finally {
      setCloning(false);
    }
  };

  const closeClone = () => {
    if (cloning) return;
    clearTimeout(cloneSearchTimer.current);
    cloneRequests.current.search++; cloneRequests.current.category++;
    setCloneOpen(false); setCloneSelectedProduct(null); setCloneSearchInput(''); setCloneSearchResults([]);
    setCloneCatSelectedProduct(null); setCloneCatId(''); setCloneCatProducts([]);
    setCloneSearchLoading(false); setCloneCatProductsLoading(false);
  };
  const copySources = (rows) => rows.filter((product) => product.id !== productId && product.type !== 'combo' && Array.isArray(product.variants) && product.variants.length > 0);
  const handleCloneSearchChange = (inputValue) => {
    setCloneSearchInput(inputValue);
    setCloneSelectedProduct(null);
    clearTimeout(cloneSearchTimer.current);
    const request = ++cloneRequests.current.search;
    setCloneSearchResults([]); setCloneSearchLoading(false);
    if (inputValue.trim().length < 2) return;
    cloneSearchTimer.current = setTimeout(async () => {
      setCloneSearchLoading(true);
      try {
        const res = await getProducts({ search: inputValue.trim(), limit: 20, include: 'variants', hasVariants: true });
        const rows = res?.data || [];
        if (request === cloneRequests.current.search) setCloneSearchResults(copySources(rows));
      } catch {
        if (request === cloneRequests.current.search) { setCloneSearchResults([]); notify('Could not search products. Try again.', 'error'); }
      } finally {
        if (request === cloneRequests.current.search) setCloneSearchLoading(false);
      }
    }, 350);
  };

  const handleCloneCatChange = async (catId) => {
    const request = ++cloneRequests.current.category;
    setCloneCatId(catId);
    setCloneCatSelectedProduct(null);
    setCloneCatProducts([]);
    if (!catId) { setCloneCatProductsLoading(false); return; }
    setCloneCatProductsLoading(true);
    try {
      const res = await getProducts({ categoryId: catId, limit: 100, include: 'variants', hasVariants: true });
      const rows = res?.data || [];
      if (request === cloneRequests.current.category) setCloneCatProducts(copySources(rows));
    } catch {
      if (request === cloneRequests.current.category) { setCloneCatProducts([]); notify('Could not load category products. Try again.', 'error'); }
    } finally {
      if (request === cloneRequests.current.category) setCloneCatProductsLoading(false);
    }
  };

  if (!productId) return <Paper sx={{ p: 3, mt: 3 }}><Typography fontWeight={700}>Attributes and variants</Typography><Typography color="text.secondary">Save the product before adding attributes or variants.</Typography></Paper>;

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Attributes and Variants
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add product details and choose the available options. Create variants, then set their stock{pricingEnabled ? ' and prices' : ''}.
        Manage reusable templates in <Link to="/admin/attributes" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>Attributes {'->'}</Link>
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5} sx={{ minWidth: 0 }}>
          <ProductAttributesSection productId={productId} rows={productAttributes} templates={attributes}
            suggestions={suggestedAttributes} loading={loading} error={loadError} canManage={canManageAttributes && !variantBusy}
            onRowsChange={setProductAttributes} onRetry={loadAll} onBusyChange={setAttributesBusy} />
        </Grid>

        <Grid item xs={12} lg={7} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" fontWeight={700}>Variant SKUs</Typography>
              <Button variant="text" size="small" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => setCloneOpen(true)} disabled={!canEditVariants || hasVariantChanges || attributesBusy} sx={{ minHeight: 44 }}>
                Copy from product
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Manage stock quantity and SKU{pricingEnabled ? ', plus a price,' : ''} for each option combination.</Typography>
            {!loading && !loadError && <VariantSetup productId={productId} rows={productAttributes} variants={variants} basePrice={productBasePrice}
              disabled={saving || cloning || deleting || attributesBusy} canManage={canManageVariants} hasUnsavedChanges={hasVariantChanges}
              onBusyChange={setGenerating} onCreated={loadAll} />}

            {!loading && !loadError && variants.length > 0 && <VariantPriceGroups rows={productAttributes} entries={variants}
              disabled={!canEditVariants || attributesBusy} saveHint="Includes available and unavailable variants. Apply, review the variants, then click Save variant changes."
              onApply={(prices) => {
                setVariants((current) => current.map((variant) => prices.has(variant.id) ? { ...variant, price: prices.get(variant.id), _dirty: true } : variant));
                notify('Grouped prices applied to draft. Review and save variant changes.', 'info');
              }} />}

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

              <Box sx={{ py: 3, px: 2, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                <Typography fontWeight={600}>{loadError ? 'Variants could not be loaded' : 'No variants yet'}</Typography>
                <Typography variant="body2" color="text.secondary">{loadError ? 'Retry loading product options before making changes.' : 'Your variants will appear here after you create them.'}</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {variants.map((variant, index) => (
                  <Accordion key={variant.id} variant="outlined" sx={{ m: '0 !important' }}>
                    <AccordionSummary
                      aria-label={getVariantOptionLabel(variant) || 'Variant SKU'}
                      expandIcon={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><Typography variant="caption">Edit</Typography><ExpandMoreIcon className="variant-expand-arrow" /></Box>}
                      sx={{
                        '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { transform: 'none' },
                        '& .variant-expand-arrow': { transition: 'transform 150ms ease' },
                        '& .Mui-expanded .variant-expand-arrow': { transform: 'rotate(180deg)' },
                        '& .MuiAccordionSummary-content': {
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          mr: 1
                        }
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1, py: 0.5 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>{getVariantOptionLabel(variant) || 'Variant SKU'}</Typography>
                        <Typography variant="caption" color="text.secondary">{pricingEnabled ? `MRP: ${Number(variant.price || 0).toLocaleString()} · ` : ''}Stock: {variant.stockQty || 0} · {variant.isActive === false ? 'Hidden' : 'Available'}{variant._dirty ? ' · Unsaved' : ''}</Typography>
                      </Box>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Delete ${getVariantOptionLabel(variant) || 'variant'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVariant(variant.id);
                        }}
                        disabled={!canEditVariants}
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
                                      disabled={!canEditVariants}
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
                                      disabled={!canEditVariants}
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
                              disabled={!canEditVariants}
                              sx={{ height: 64, borderStyle: 'dashed' }}
                            >
                              Add Images
                            </Button>
                          </Box>
                        </Grid>
                        {pricingEnabled && <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="MRP"
                            type="number"
                            value={variant.price}
                            onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                            disabled={!canEditVariants}
                            inputProps={{ min: 0, step: '0.01' }}
                            error={variant._dirty && !validPrice(variant.price)}
                            helperText={variant._dirty && !validPrice(variant.price) ? 'Enter a price with up to 2 decimals.' : undefined}
                          />
                        </Grid>}
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Stock Qty"
                            type="number"
                            value={variant.stockQty}
                            onChange={(e) => handleVariantChange(index, 'stockQty', e.target.value)}
                            disabled={!canEditVariants}
                            inputProps={{ min: 0 }}
                            error={variant._dirty && !validStock(variant)}
                            helperText={variant._dirty && !validStock(variant) ? `Enter a whole number, at least ${variant.reservedQty || 0}.` : Number(variant.reservedQty || 0) > 0 ? `${variant.reservedQty} reserved` : undefined}
                          />
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            fullWidth
                            size="small"
                            label="SKU"
                            value={variant.sku || ''}
                            onChange={(e) => handleVariantChange(index, 'sku', e.target.value)}
                            disabled={!canEditVariants}
                            placeholder="Optional SKU"
                            inputProps={{ maxLength: 100 }}
                            error={variant._dirty && duplicateSku(variant)}
                            helperText={variant._dirty && duplicateSku(variant) ? 'Each variant must have a different SKU.' : undefined}
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
                        <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={variant.isActive !== false}
                                onChange={(e) => handleVariantChange(index, 'isActive', e.target.checked)}
                                disabled={!canEditVariants}
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
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Shipping measurements (optional — leave blank to inherit from product):
                          </Typography>
                          <Grid container spacing={1}>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Weight (g)"
                                type="number"
                                value={variant.weightGrams ?? ''}
                                placeholder="Inherited"
                                onChange={(e) => handleVariantChange(index, 'weightGrams', e.target.value)}
                                disabled={!canEditVariants}
                                inputProps={{ min: 0, step: 1 }}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Length (cm)"
                                type="number"
                                value={variant.lengthCm ?? ''}
                                placeholder="Inherited"
                                onChange={(e) => handleVariantChange(index, 'lengthCm', e.target.value)}
                                disabled={!canEditVariants}
                                inputProps={{ min: 0.5, step: 0.5 }}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Width (cm)"
                                type="number"
                                value={variant.breadthCm ?? ''}
                                placeholder="Inherited"
                                onChange={(e) => handleVariantChange(index, 'breadthCm', e.target.value)}
                                disabled={!canEditVariants}
                                inputProps={{ min: 0.5, step: 0.5 }}
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                size="small"
                                label="Height (cm)"
                                type="number"
                                value={variant.heightCm ?? ''}
                                placeholder="Inherited"
                                onChange={(e) => handleVariantChange(index, 'heightCm', e.target.value)}
                                disabled={!canEditVariants}
                                inputProps={{ min: 0.5, step: 0.5 }}
                              />
                            </Grid>
                          </Grid>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
            {variants.length > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, borderTop: 1, borderColor: 'divider', pt: 2, mt: 2 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>{variants.length} {variants.length === 1 ? 'variant' : 'variants'} · Total stock: {variants.filter((variant) => variant.isActive !== false).reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0)}</Typography>
                <Typography variant="caption" color={hasInvalidChanges ? 'error' : 'text.secondary'}>{hasInvalidChanges ? 'Fix the highlighted prices, stock quantities, or duplicate SKUs before saving.' : hasVariantChanges ? 'You have unsaved variant changes.' : 'All variant changes saved.'}</Typography>
              </Box>
              <Button variant="contained" onClick={handleSaveVariants} disabled={!canEditVariants || !hasVariantChanges || hasInvalidChanges || attributesBusy} sx={{ minHeight: 44 }}>
                {saving ? `Saving (${saveProgress.current}/${saveProgress.total})…` : 'Save variant changes'}
              </Button>
            </Box>}
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

      <Dialog open={cloneOpen} onClose={closeClone} maxWidth="sm" fullWidth>
        <DialogTitle>Clone Variants from Another Product</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Required attributes, values and combinations are copied automatically. New variants start with zero stock and fresh unique SKUs. Variant photos are not copied. Existing combinations keep their prices, stock and SKUs.
          </Typography>
          <Tabs value={cloneTab} onChange={(_, value) => { clearTimeout(cloneSearchTimer.current); cloneRequests.current.search++; cloneRequests.current.category++; setCloneSearchLoading(false); setCloneCatProductsLoading(false); setCloneTab(value); setCloneSelectedProduct(null); setCloneCatSelectedProduct(null); setCloneSearchInput(''); setCloneSearchResults([]); setCloneCatId(''); setCloneCatProducts([]); }} sx={{ mb: 2 }}>
            <Tab label="Search by name or SKU" disabled={cloning} />
            <Tab label="Browse by Category" disabled={cloning} />
          </Tabs>

          {cloneTab === 0 && (
            <Autocomplete
              options={cloneSearchResults}
              disabled={cloning}
              getOptionLabel={(option) => option.name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, option) => <li {...props} key={option.id}><Box><Typography variant="body2">{option.name}</Typography><Typography variant="caption" color="text.secondary">{option.sku || 'No product SKU'} · {option.variants.length} variants</Typography></Box></li>}
              filterOptions={(x) => x}
              loading={cloneSearchLoading}
              value={cloneSelectedProduct}
              onChange={(_, value) => { setCloneSelectedProduct(value); setCloneSearchInput(value?.name || ''); }}
              inputValue={cloneSearchInput}
              onInputChange={(_, value, reason) => { if (reason !== 'reset') handleCloneSearchChange(value); }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search products"
                  placeholder="Type product name..."
                  size="small"
                  helperText="Search by product name or product SKU (at least 2 characters). Only products with variants are shown."
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
              noOptionsText={cloneSearchInput.trim().length >= 2 ? 'No matching products with variants' : 'Type at least 2 characters'}
            />
          )}

          {cloneTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth size="small" disabled={cloning}>
                <InputLabel id="clone-category-label">Select Category</InputLabel>
                <Select labelId="clone-category-label" label="Select Category" value={cloneCatId} onChange={(e) => handleCloneCatChange(e.target.value)}>
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
                  <Typography variant="body2" color="text.secondary">No other products with variants in this category.</Typography>
                ) : (
                  <FormControl fullWidth size="small" disabled={cloning}>
                    <InputLabel id="clone-product-label">Select Product</InputLabel>
                    <Select labelId="clone-product-label" label="Select Product" value={cloneCatSelectedProduct?.id || ''} onChange={(e) => setCloneCatSelectedProduct(cloneCatProducts.find((product) => product.id === e.target.value) || null)}>
                      <MenuItem value=""><em>Select product</em></MenuItem>
                      {cloneCatProducts.map((product) => (
                        <MenuItem key={product.id} value={product.id}>{product.name} · {product.sku || 'No product SKU'} · {product.variants.length} variants</MenuItem>
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
          <Button color="error" onClick={closeClone} disabled={cloning}>Cancel</Button>
          <Button variant="contained" onClick={handleClone} disabled={cloning || !(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct)}>
            {cloning ? 'Cloning...' : 'Clone Variants'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};


export default VariantsPanel;
