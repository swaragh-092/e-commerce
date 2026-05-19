import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Grid, Paper,
  FormControl, InputLabel, Select, MenuItem, Chip,
  Table, TableHead, TableRow, TableBody, TableCell,
  CircularProgress, Tooltip, IconButton, Divider, Alert,
  InputAdornment, Autocomplete, Tabs, Tab, Checkbox,
  FormControlLabel, Accordion, AccordionSummary, AccordionDetails,
  Switch, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  OutlinedInput,
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
import { getProductById, getProducts } from '../../services/productService';
import attributeService from '../../services/attributeService';
import MediaPicker from '../common/MediaPicker';
import { useNotification } from '../../context/NotificationContext';
import { getProductBasePrice } from '../../utils/variantPricing';
import { getVariantOptionLabel } from '../../utils/variantOptions';
import { formatAttributeValue, getSwatchColor } from '../../utils/attributePresentation';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../utils/apiErrors';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const getAttributeRowName = (row) =>
  row.attribute?.name || row.customName || 'Unknown';

const getAttributeRowValue = (row) =>
  row?.value?.displayLabel || row?.value?.value || row?.customValue || 'Default';

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


export default VariantsPanel;
