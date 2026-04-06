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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ContentCopy as ContentCopyIcon, ElectricBolt as ElectricBoltIcon } from '@mui/icons-material';
import useSKUGenerator from '../../hooks/useSKUGenerator';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { getProductById, getProducts, createProduct, updateProduct } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import attributeService from '../../services/attributeService';
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
  const { generateProductSKU } = useSKUGenerator();

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
        const res = await createProduct(payload);
        const newId = res?.data?.product?.id;
        notify('Product created! You can now add variants below.', 'success');
        navigate(`/admin/products/${newId}/edit`, { replace: true });
      } else {
        await updateProduct(id, payload);
        notify('Product updated successfully!', 'success');
      }
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
                  value.map((option, index) => (
                    <Chip
                      key={option.id}
                      label={option.depth > 0 ? option.path : option.name}
                      size="small"
                      title={option.path}
                      {...getTagProps({ index })}
                    />
                  ))
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
                          disabled={!formData.name.trim()}
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

      {/* Variants panel — only visible once the product has been saved and has a real ID */}
      {!isNew && <VariantsPanel productId={id} baseSku={formData.sku} flatCatFiles={flatCatFiles} />}
    </Box>
  );
};

/* ─── Variants Panel ──────────────────────────────────────────────────────── */
const VariantsPanel = ({ productId, baseSku, flatCatFiles = [] }) => {
  const notify = useNotification();
  const { generateVariantSKU } = useSKUGenerator();
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [cloneSourceName, setCloneSourceName] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneTab, setCloneTab] = useState(0);
  // Tab 0: search by name
  const [cloneSearchInput, setCloneSearchInput] = useState('');
  const [cloneSearchResults, setCloneSearchResults] = useState([]);
  const [cloneSearchLoading, setCloneSearchLoading] = useState(false);
  const [cloneSelectedProduct, setCloneSelectedProduct] = useState(null);
  // Tab 1: browse by category
  const [cloneCatId, setCloneCatId] = useState('');
  const [cloneCatProducts, setCloneCatProducts] = useState([]);
  const [cloneCatProductsLoading, setCloneCatProductsLoading] = useState(false);
  const [cloneCatSelectedProduct, setCloneCatSelectedProduct] = useState(null);
  const cloneSearchTimer = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [varRes, attrRes] = await Promise.all([
        attributeService.getProductVariants(productId),
        attributeService.getAttributes({ limit: 100 }),
      ]);
      const varData = varRes?.data?.data || [];
      const attrData = attrRes?.data?.data?.rows || attrRes?.data?.data || [];
      setVariants(varData.map((v) => ({ ...v, _dirty: false, _new: false })));
      setAttributes(attrData);
    } catch {
      notify('Failed to load variants.', 'error');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Add all values from the selected attribute template as pending rows
  const handleAddFromTemplate = () => {
    const tmpl = attributes.find((a) => a.id === selectedTemplate);
    if (!tmpl) return;
    if (!tmpl.values?.length) {
      notify(`"${tmpl.name}" has no values. Add values in the Attributes section first.`, 'warning');
      return;
    }
    setVariants((prev) => [
      ...prev,
      ...tmpl.values.map((v) => ({
        _tempId: `${Date.now()}-${Math.random()}`,
        _new: true,
        _dirty: false,
        name: tmpl.name,
        value: v.value,
        priceModifier: 0,
        quantity: 0,
        sku: '',
      })),
    ]);
    setSelectedTemplate('');
  };

  // Add a blank custom row
  const handleAddCustom = () => {
    setVariants((prev) => [
      ...prev,
      {
        _tempId: `${Date.now()}-${Math.random()}`,
        _new: true,
        _dirty: false,
        name: '',
        value: '',
        priceModifier: 0,
        quantity: 0,
        sku: '',
      },
    ]);
  };

  const handleChange = (index, field, value) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value, _dirty: true } : v))
    );
  };

  const handleDelete = async (index) => {
    const v = variants[index];
    if (v._new) {
      setVariants((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (!window.confirm('Delete this variant?')) return;
    try {
      await attributeService.deleteProductVariant(productId, v.id);
      setVariants((prev) => prev.filter((_, i) => i !== index));
      notify('Variant deleted.', 'success');
    } catch {
      notify('Failed to delete variant.', 'error');
    }
  };

  // Save all new/dirty rows in one click
  const handleSaveVariants = async () => {
    const toCreate = variants.filter((v) => v._new && v.name.trim() && v.value.trim());
    const toUpdate = variants.filter((v) => !v._new && v._dirty);
    if (toCreate.length === 0 && toUpdate.length === 0) {
      notify('No changes to save.', 'info');
      return;
    }
    setSaving(true);
    try {
      for (const v of toCreate) {
        await attributeService.addProductVariant(productId, {
          name: v.name.trim(),
          value: v.value.trim(),
          priceModifier: parseFloat(v.priceModifier) || 0,
          quantity: parseInt(v.quantity, 10) || 0,
          sku: v.sku?.trim() || null,
        });
      }
      for (const v of toUpdate) {
        await attributeService.updateProductVariant(productId, v.id, {
          name: v.name.trim(),
          value: v.value.trim(),
          priceModifier: parseFloat(v.priceModifier) || 0,
          quantity: parseInt(v.quantity, 10) || 0,
          sku: v.sku?.trim() || null,
        });
      }
      notify('Variants saved successfully.', 'success');
      loadAll();
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save variants.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const hasPending = variants.some((v) => v._new || v._dirty);

  const handleClone = async () => {
    const activeProduct = cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct;
    if (!activeProduct) return;
    setCloning(true);
    try {
      await attributeService.cloneVariants(productId, { sourceProductId: activeProduct.id });
      notify(`Variants cloned from "${activeProduct.name}" successfully!`, 'success');
      setCloneOpen(false);
      // reset dialog state
      setCloneSelectedProduct(null); setCloneSearchInput(''); setCloneSearchResults([]);
      setCloneCatSelectedProduct(null); setCloneCatId(''); setCloneCatProducts([]);
      loadAll();
    } catch (err) {
      notify(err?.response?.data?.error?.message || err?.response?.data?.message || 'Clone failed.', 'error');
    } finally {
      setCloning(false);
    }
  };

  // Debounced search for clone tab 0
  const handleCloneSearchChange = (inputValue) => {
    setCloneSearchInput(inputValue);
    setCloneSelectedProduct(null);
    clearTimeout(cloneSearchTimer.current);
    if (!inputValue.trim()) { setCloneSearchResults([]); return; }
    cloneSearchTimer.current = setTimeout(async () => {
      setCloneSearchLoading(true);
      try {
        const res = await getProducts({ search: inputValue.trim(), limit: 20 });
        const rows = res?.data || [];
        // exclude current product from results
        setCloneSearchResults(rows.filter(p => p.id !== productId));
      } catch { setCloneSearchResults([]); }
      finally { setCloneSearchLoading(false); }
    }, 350);
  };

  // Load products when category is selected in clone tab 1
  const handleCloneCatChange = async (catId) => {
    setCloneCatId(catId);
    setCloneCatSelectedProduct(null);
    setCloneCatProducts([]);
    if (!catId) return;
    setCloneCatProductsLoading(true);
    try {
      const res = await getProducts({ categoryId: catId, limit: 100 });
      const rows = res?.data || [];
      setCloneCatProducts(rows.filter(p => p.id !== productId));
    } catch { setCloneCatProducts([]); }
    finally { setCloneCatProductsLoading(false); }
  };

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Variants</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Copy all variants from another product">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon fontSize="small" />}
              onClick={() => setCloneOpen(true)}
            >
              Clone from Product
            </Button>
          </Tooltip>
          {hasPending && (
            <Button variant="contained" size="small" onClick={handleSaveVariants} disabled={saving}>
              {saving ? 'Saving…' : 'Save Variants'}
            </Button>
          )}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each row (e.g. Color=Red, Size=M) is an independent SKU with its own stock, price adjustment and SKU code.
        Manage reusable templates in{' '}
        <Link to="/admin/attributes" style={{ color: 'inherit', fontWeight: 600 }}>Attributes →</Link>
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {/* ── Template Picker ── */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Load from Template</InputLabel>
          <Select
            value={selectedTemplate}
            label="Load from Template"
            onChange={(e) => setSelectedTemplate(e.target.value)}
          >
            <MenuItem value="">— select —</MenuItem>
            {attributes.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.name}{a.values?.length ? ` (${a.values.length} values)` : ' — no values'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Adds one row per value in the selected template (e.g. Color → Red, Blue, Green)">
          <span>
            <Button
              variant="outlined"
              size="small"
              disabled={!selectedTemplate}
              onClick={handleAddFromTemplate}
            >
              + Add All Values
            </Button>
          </span>
        </Tooltip>
        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddCustom}>
          Custom Row
        </Button>
      </Box>

      {/* ── Variants Table ── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      ) : variants.length === 0 ? (
        <Alert severity="info">
          No variants yet. Select a template above or add a custom row, then click <strong>Save Variants</strong>.
        </Alert>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>Attribute</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Price Adj (±)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Stock Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {variants.map((v, i) => (
                <TableRow
                  key={v.id || v._tempId}
                  sx={{ bgcolor: v._new ? 'action.selected' : undefined }}
                >
                  <TableCell>
                    <TextField
                      size="small"
                      value={v.name}
                      onChange={(e) => handleChange(i, 'name', e.target.value)}
                      placeholder="e.g. Color"
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={v.value}
                      onChange={(e) => handleChange(i, 'value', e.target.value)}
                      placeholder="e.g. Red"
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={v.priceModifier}
                      onChange={(e) => handleChange(i, 'priceModifier', e.target.value)}
                      sx={{ width: 100 }}
                      inputProps={{ step: 0.01 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={v.quantity}
                      onChange={(e) => handleChange(i, 'quantity', e.target.value)}
                      sx={{ width: 90 }}
                      inputProps={{ min: 0 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TextField
                        size="small"
                        value={v.sku || ''}
                        onChange={(e) => handleChange(i, 'sku', e.target.value)}
                        placeholder="optional"
                        sx={{ width: 130 }}
                      />
                      <Tooltip title="Auto-generate SKU from attribute name/value (uses SKU settings)">
                        <IconButton
                          size="small"
                          onClick={() =>
                            handleChange(i, 'sku', generateVariantSKU(baseSku, v.name, v.value))
                          }
                        >
                          <ElectricBoltIcon fontSize="small" color="warning" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Delete variant">
                      <IconButton size="small" color="error" onClick={() => handleDelete(i)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* ── Clone Dialog ── */}
      <Dialog open={cloneOpen} onClose={() => setCloneOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Clone Variants from Another Product</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Variant names, values and price modifiers will be copied. Quantities reset to 0 and SKUs cleared.
          </Typography>
          <Tabs value={cloneTab} onChange={(_, v) => { setCloneTab(v); setCloneSelectedProduct(null); setCloneCatSelectedProduct(null); }} sx={{ mb: 2 }}>
            <Tab label="Search by Product Name" />
            <Tab label="Browse by Category" />
          </Tabs>

          {/* Tab 0: search by name */}
          {cloneTab === 0 && (
            <Autocomplete
              options={cloneSearchResults}
              getOptionLabel={(o) => o.name || ''}
              filterOptions={(x) => x}
              loading={cloneSearchLoading}
              value={cloneSelectedProduct}
              onChange={(_, val) => setCloneSelectedProduct(val)}
              inputValue={cloneSearchInput}
              onInputChange={(_, val, reason) => { if (reason !== 'reset') handleCloneSearchChange(val); }}
              renderOption={(props, option) => (
                <Box component="li" {...props} key={option.id}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.categories?.map(c => c.name).join(', ') || 'No category'}
                    </Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search products"
                  placeholder="Type product name..."
                  size="small"
                  InputProps={{ ...params.InputProps, endAdornment: (
                    <>
                      {cloneSearchLoading && <CircularProgress size={16} />}
                      {params.InputProps.endAdornment}
                    </>
                  )}}
                />
              )}
              noOptionsText={cloneSearchInput.length > 0 ? 'No products found' : 'Start typing to search'}
            />
          )}

          {/* Tab 1: browse by category then product */}
          {cloneTab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Category</InputLabel>
                <Select
                  label="Select Category"
                  value={cloneCatId}
                  onChange={(e) => handleCloneCatChange(e.target.value)}
                >
                  <MenuItem value=""><em>— pick a category —</em></MenuItem>
                  {flatCatFiles.map((c) => (
                    <MenuItem key={c.id} value={c.id} sx={{ pl: 2 + c.depth * 2 }}>
                      {c.path}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {cloneCatId && (
                cloneCatProductsLoading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Loading products…</Typography>
                  </Box>
                ) : cloneCatProducts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No other products in this category.</Typography>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel>Select Product</InputLabel>
                    <Select
                      label="Select Product"
                      value={cloneCatSelectedProduct?.id || ''}
                      onChange={(e) => setCloneCatSelectedProduct(cloneCatProducts.find(p => p.id === e.target.value) || null)}
                    >
                      <MenuItem value=""><em>— pick a product —</em></MenuItem>
                      {cloneCatProducts.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )
              )}
            </Box>
          )}

          {/* Confirmation */}
          {(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Will clone variants from: <strong>{(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct)?.name}</strong>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCloneOpen(false);
            setCloneSelectedProduct(null); setCloneSearchInput(''); setCloneSearchResults([]);
            setCloneCatSelectedProduct(null); setCloneCatId(''); setCloneCatProducts([]);
          }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleClone}
            disabled={cloning || !(cloneTab === 0 ? cloneSelectedProduct : cloneCatSelectedProduct)}
          >
            {cloning ? 'Cloning…' : 'Clone Variants'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ProductEditPage;
