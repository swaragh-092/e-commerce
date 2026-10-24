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
  Breadcrumbs,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageIcon from '@mui/icons-material/Image';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
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
import { useCurrency, useSettings, useFeature, useFeatureVisible, useFeaturesResolved } from '../../hooks/useSettings';
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
import ProductAssistantPanel from '../../components/admin/ProductAssistantPanel';
import UnitSelector from '../../components/admin/UnitSelector';
import { toDateTimeLocal } from '../../utils/dates';

import { generateSlug } from '../../utils/strings';
import { walkCategoryTree } from '../../utils/categories';
import {
  PRODUCT_STOREFRONT_STATES,
  PRODUCT_STOREFRONT_STATE_LABELS,
  getProductStorefrontFields,
  getProductStorefrontState,
  getProductStorefrontStateHelp,
} from '../../utils/productStorefrontState';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const buildAssistantDescription = (draft = {}) => {
  const longDescription = draft.longDescription?.trim() || '';
  const featureBullets = Array.isArray(draft.featureBullets) ? draft.featureBullets.filter(Boolean) : [];

  if (featureBullets.length === 0) {
    return longDescription;
  }

  const bulletList = `<ul>${featureBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  return longDescription ? `${longDescription}\n${bulletList}` : bulletList;
};

const shouldAutoRefreshSlug = (currentSlug, previousName, nextName) => {
  if (!nextName?.trim()) return false;
  if (!currentSlug?.trim()) return true;
  return currentSlug === generateSlug(previousName || '');
};

const validate = (formData) => {
  const errs = {};
  if (!formData.name?.trim()) errs.name = 'Product name is required.';
  else if (formData.name?.trim().length > 255)
    errs.name = 'Product name must be 255 characters or less.';

  const pricingEnabled = formData._features?.pricing === true;
  const shippingEnabled = formData._features?.shipping === true;


  if (pricingEnabled) {
    const rPrice = Number(formData.price);
    if (formData.price === '' || formData.price === null || formData.price === undefined) {
      errs.price = 'MRP is required.';
    } else if (isNaN(rPrice) || rPrice <= 0) {
      errs.price = 'MRP must be a positive number.';
    }

    if (formData.salePrice !== '' && formData.salePrice !== null) {
      const sPrice = Number(formData.salePrice);
      if (isNaN(sPrice) || sPrice <= 0) {
        errs.salePrice = 'Sale price must be a positive number.';
      } else if (!isNaN(rPrice) && rPrice > 0 && sPrice >= rPrice) {
        errs.salePrice = 'Sale price must be less than the MRP.';
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
    formData.type === 'simple' && formData.quantity !== '' &&
    (!Number.isInteger(Number(formData.quantity)) || Number(formData.quantity) < 0 || Number(formData.quantity) > 2147483647)
  ) {
    errs.quantity = 'Stock quantity must be a whole number from 0 to 2147483647.';
  }

  if (formData.shortDescription && formData.shortDescription.length > 500) {
    errs.shortDescription = 'Short description must be 500 characters or less.';
  }

  if (formData.sku && formData.sku.length > 100) {
    errs.sku = 'SKU must be 100 characters or less.';
  }

  if (formData.unit && formData.unit.length > 50) {
    errs.unit = 'Unit must be 50 characters or less.';
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

  // Shipping Readiness Validation for purchasable (published) products
  if (shippingEnabled && formData.requiresShipping && formData.status === 'published') {
    if (!formData.weightGrams || Number(formData.weightGrams) <= 0) {
      errs.weightGrams = 'Weight (> 0 g) is required before publishing.';
    }
    if (!formData.lengthCm || Number(formData.lengthCm) <= 0.5) {
      errs.lengthCm = 'Length (> 0.5 cm) is required before publishing.';
    }
    if (!formData.breadthCm || Number(formData.breadthCm) <= 0.5) {
      errs.breadthCm = 'Breadth (> 0.5 cm) is required before publishing.';
    }
    if (!formData.heightCm || Number(formData.heightCm) <= 0.5) {
      errs.heightCm = 'Height (> 0.5 cm) is required before publishing.';
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
  const pricingEnabled = useFeatureVisible('pricing', 'admin');
  const featuresResolved = useFeaturesResolved();
  const pricingCapability = useFeature('pricing');
  const shippingCapability = useFeature('shipping');
  const brandsEnabled = useFeature('brands');
  const seoEnabled = useFeature('seo');
  const productAssistantEnabled = useFeature('productAssistant');
  const canSaveProduct = featuresResolved && (isNew ? canCreateProducts : canUpdateProducts);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    sku: '',
    unit: '',
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
    packingMode: 'standard',
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
  const [variantCount, setVariantCount] = useState(0);
  const [variantStockTotal, setVariantStockTotal] = useState(0);
  const [globalPrimaryVersion, setGlobalPrimaryVersion] = useState(0);
  const initialFormRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const catRes = await getCategoryTree();
        setCategories(catRes?.data || []);

        if (brandsEnabled) {
          const brandRes = await brandService.getBrands({ limit: 100, isActive: 'true' });
          setBrands(brandRes?.data?.data || []);
        } else {
          setBrands([]);
        }

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
            setVariantCount(Array.isArray(p.variants) ? p.variants.length : 0);
            setVariantStockTotal(nextVariantStockTotal);

            const loadedFormData = {
              name: p.name || '',
              slug: p.slug || '',
              description: p.description || '',
              shortDescription: p.shortDescription || '',
              sku: p.sku || '',
              unit: p.unit || '',
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
              packingMode: p.packingMode || 'standard',
              weightGrams: p.weightGrams ?? '',
              lengthCm:    p.lengthCm    ?? '',
              breadthCm:   p.breadthCm   ?? '',
              heightCm:    p.heightCm    ?? '',
              // SEO Fields
              metaTitle: p.metaTitle || '',
              metaDescription: p.metaDescription || '',
              metaKeywords: p.metaKeywords || '',
              ogImage: p.ogImage || '',
            };
            setFormData(loadedFormData);
            initialFormRef.current = JSON.stringify(loadedFormData);
          }
        }
      } catch (err) {
        notify('Failed to load product data.', 'error');
      }
    };
    load();
  }, [id, isNew, brandsEnabled]);

  useEffect(() => {
    if (isNew && !initialFormRef.current) {
      initialFormRef.current = JSON.stringify(formData);
    }
  }, [isNew]);

  const isDirty = () => {
    if (!initialFormRef.current) return false;
    return JSON.stringify(formData) !== initialFormRef.current;
  };

  const handleBack = async () => {
    if (isDirty()) {
      const confirmed = await confirm({
        title: 'Discard unsaved changes?',
        message: 'You have unsaved changes on this product. Are you sure you want to leave?',
        confirmText: 'Discard & Leave',
        cancelText: 'Keep Editing',
        severity: 'warning',
      });
      if (confirmed) {
        navigate('/admin/products');
      }
    } else {
      navigate('/admin/products');
    }
  };

  const handleCancel = async () => {
    if (isDirty()) {
      const confirmed = await confirm({
        title: 'Discard unsaved changes?',
        message: 'You have unsaved changes on this product. Are you sure you want to cancel?',
        confirmText: 'Discard Changes',
        cancelText: 'Keep Editing',
        severity: 'warning',
      });
      if (confirmed) {
        navigate('/admin/products');
      }
    } else {
      navigate('/admin/products');
    }
  };

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const priceNum = Number(formData.price);
  const salePriceNum = formData.salePrice !== '' && formData.salePrice !== null && formData.salePrice !== undefined
    ? Number(formData.salePrice)
    : null;
  const hasValidDiscount =
    Number.isFinite(priceNum) &&
    priceNum > 0 &&
    salePriceNum !== null &&
    Number.isFinite(salePriceNum) &&
    salePriceNum > 0 &&
    salePriceNum < priceNum;

  const discountAmount = hasValidDiscount ? priceNum - salePriceNum : 0;
  const discountPercent = hasValidDiscount ? Math.round(((priceNum - salePriceNum) / priceNum) * 100) : 0;

  const handleVariantStockChange = useCallback((total, count, fallbackQuantity, totalCount) => {
    setVariantStockTotal(total);
    if (totalCount !== undefined) setVariantCount(totalCount);
    setHasVariants(count > 0);
    if (count > 0) {
      setFormData((prev) => ({ ...prev, quantity: total }));
      setErrors((prev) => ({ ...prev, quantity: undefined }));
    } else if (fallbackQuantity !== undefined) {
      setFormData((prev) => ({ ...prev, quantity: fallbackQuantity }));
    }
  }, []);

  const applyAssistantResult = useCallback((result) => {
    const draft = result?.draft || {};
    const attributes = result?.attributes || {};
    const matchedBrand = brandsEnabled && attributes.brand
      ? brands.find((brand) => brand.name?.trim().toLowerCase() === attributes.brand.trim().toLowerCase())
      : null;

    setFormData((prev) => {
      const nextTitle = draft.title || prev.name;
      const nextSlug = shouldAutoRefreshSlug(prev.slug, prev.name, nextTitle)
        ? generateSlug(nextTitle)
        : prev.slug;

      return {
        ...prev,
        name: nextTitle,
        slug: nextSlug,
        shortDescription: draft.shortDescription || prev.shortDescription,
        description: buildAssistantDescription(draft) || prev.description,
        metaTitle: draft.metaTitle || prev.metaTitle,
        metaDescription: draft.metaDescription || prev.metaDescription,
        metaKeywords: draft.seoKeywords?.length ? draft.seoKeywords.join(', ') : prev.metaKeywords,
        sku: attributes.sku || prev.sku,
        unit: attributes.unit || prev.unit,
        brandId: matchedBrand?.id || prev.brandId,
      };
    });

    setErrors((prev) => ({
      ...prev,
      name: undefined,
      slug: undefined,
      shortDescription: undefined,
      sku: undefined,
      unit: undefined,
    }));

    if (brandsEnabled && attributes.brand && !matchedBrand) {
      notify(`AI detected brand "${attributes.brand}", but it does not match an existing brand record.`, 'warning');
    } else {
      notify('AI content applied to the product form.', 'success');
    }
  }, [brands, brandsEnabled, notify]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSaveProduct) {
      notify(`You do not have permission to ${isNew ? 'create' : 'update'} products.`, 'error');
      return;
    }

    const effectiveQuantity = formData.type === 'variable' || hasVariants ? variantStockTotal : formData.quantity;
    const errs = validate({ ...formData, quantity: effectiveQuantity, _features: { pricing: pricingCapability, shipping: shippingCapability } });

    // Block type change if invariants are violated
    if (!isNew && dbProduct && formData.type !== dbProduct.type) {
        if (formData.type !== 'variable' && variantCount > 0) {
            errs.type = 'Remove all variants, including inactive ones, before changing to Simple or Combo.';
        }
        if (formData.type !== 'combo' && dbProduct.comboItems?.length > 0) {
            errs.type = `Cannot change to ${formData.type} type: this product has combo items. Clear the bundle first.`;
        }
    }

    if (formData.type === 'simple' && variantCount > 0) errs.type = 'This product already has variants. Select Variable Product and save.';

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (errs.type) notify(errs.type, 'error');
      else notify(`Please fix the following before saving: ${Object.values(errs).join(' ')}`, 'warning');
      return;
    }

    let confirmInventoryReset = false;
    if (!isNew && dbProduct?.type === 'simple' && formData.type !== 'simple' && !variantCount && Number(dbProduct.quantity || 0) > 0) {
      confirmInventoryReset = await confirm({ title: 'Change how stock is managed?', message: `This product has ${dbProduct.quantity} units of standalone stock. Switching type clears that total. Set stock on each variant or bundle component afterward; units are not distributed automatically.`, confirmText: 'Change type and clear stock', cancelText: 'Keep editing', severity: 'warning' });
      if (!confirmInventoryReset) return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        price: formData.price === '' ? null : Number(formData.price),
        salePrice:
          formData.salePrice !== '' && formData.salePrice !== null && !isNaN(parseFloat(formData.salePrice))
            ? parseFloat(formData.salePrice)
            : null,
        saleStartAt: (formData.salePrice !== '' && formData.salePrice !== null) ? toIsoOrNull(formData.saleStartAt) : null,
        saleEndAt: (formData.salePrice !== '' && formData.salePrice !== null) ? toIsoOrNull(formData.saleEndAt) : null,
        saleLabel: (formData.salePrice !== '' && formData.salePrice !== null) ? (formData.saleLabel || null) : null,
        brandId: formData.brandId || null,
        unit: formData.unit?.trim() || null,
        type: formData.type || 'simple',
        // Shipping dimensions — null when blank so DB stores NULL cleanly
        requiresShipping: formData.requiresShipping,
        packingMode: formData.packingMode || 'standard',
        weightGrams: formData.weightGrams !== '' ? Number(formData.weightGrams) : null,
        lengthCm:    formData.lengthCm    !== '' ? Number(formData.lengthCm)    : null,
        breadthCm:   formData.breadthCm   !== '' ? Number(formData.breadthCm)   : null,
        heightCm:    formData.heightCm    !== '' ? Number(formData.heightCm)    : null,
        // SEO Fields
        metaTitle: formData.metaTitle || null,
        metaDescription: formData.metaDescription || null,
        metaKeywords: formData.metaKeywords || null,
        ogImage: formData.ogImage || null,
      };

      if (!pricingCapability) {
        if (isNew) payload.price = 0;
        else delete payload.price;
        for (const key of ['salePrice', 'saleStartAt', 'saleEndAt', 'saleLabel', 'taxConfig']) delete payload[key];
      }
      if (!shippingCapability) {
        for (const key of ['requiresShipping', 'packingMode', 'weightGrams', 'lengthCm', 'breadthCm', 'heightCm']) delete payload[key];
      }
      if (!brandsEnabled) delete payload.brandId;
      if (!seoEnabled) for (const key of ['metaTitle', 'metaDescription', 'metaKeywords', 'ogImage']) delete payload[key];

      // Variant and bundle stock is managed by their own editors.
      delete payload.quantity;
      if (payload.type === 'simple') {
        payload.quantity = parseInt(formData.quantity) || 0;
      }
      if (confirmInventoryReset) payload.confirmInventoryReset = true;
      if (isNew) {
        const res = await createProduct(payload);
        const newId = res?.data?.id;

        if (!newId) {
          notify('Product created but ID not returned. Please refresh the product list.', 'warning');
          navigate('/admin/products');
          return;
        }

        notify(payload.type === 'variable' ? 'Product saved. Add attributes and create variants below.' : 'Product created successfully.', 'success');
        initialFormRef.current = JSON.stringify(formData);
        navigate(`/admin/products/${newId}/edit`, { replace: true });
      } else {
        const res = await updateProduct(id, payload);
        if (res?.data) {
          setDbProduct(res.data);
          if (payload.type === 'variable') {
            const active = (res.data.variants || []).filter((variant) => variant.isActive !== false);
            setVariantStockTotal(active.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0));
            setVariantCount((res.data.variants || []).length);
          }
        }
        initialFormRef.current = JSON.stringify(formData);
        notify('Product updated successfully.', 'success');
      }
    } catch (err) {
      const details = err?.response?.data?.error?.details;
      const validationMessage = Array.isArray(details)
        ? details.map((detail) => detail.message).filter(Boolean).join(' ')
        : '';
      notify(validationMessage || getApiErrorMessage(err), 'error');
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
  const previewPrice = getProductBasePrice(formData, new Date());
  const previewPriceLabel = previewPrice < Number(formData.price) ? 'Active sale price' : 'MRP';
  const productTypeLabel = formData.type === 'variable' ? 'Variable' : formData.type === 'combo' ? 'Combo' : 'Simple';

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, mx: 'auto' }}>
      <form onSubmit={handleSave} noValidate>
        {/* Sticky Action Bar */}
        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            top: { xs: 56, sm: 64 },
            zIndex: 10,
            mt: { xs: -1, sm: -1.5 },
            mb: 3,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? 'rgba(255, 255, 255, 0.94)'
                : 'rgba(30, 30, 30, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: (theme) =>
              theme.palette.mode === 'light'
                ? '0 4px 20px rgba(0, 0, 0, 0.05)'
                : '0 4px 20px rgba(0, 0, 0, 0.4)',
            transition: 'box-shadow 0.2s ease',
          }}
        >
          {/* Left: Back button + Breadcrumbs + Title + Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title="Back to Products">
              <IconButton
                onClick={handleBack}
                size="medium"
                aria-label="Back to Products"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  p: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Box>
              <Breadcrumbs
                separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
                sx={{ fontSize: '0.75rem', mb: 0.25 }}
              >
                <Link
                  to="/admin/products"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  Products
                </Link>
                <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {isNew ? 'New Product' : 'Edit'}
                </Typography>
              </Breadcrumbs>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" component="h1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {isNew ? 'Create Product' : (formData.name || 'Untitled Product')}
                </Typography>
                <Chip
                  size="small"
                  label={(formData.status || 'draft').toUpperCase()}
                  color={formData.status === 'published' ? 'success' : 'default'}
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={productTypeLabel}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>
            </Box>
          </Box>

          {/* Right: Cancel & Save Action Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="outlined"
              color="error"
              onClick={handleCancel}
              disabled={saving}
              startIcon={<CloseIcon />}
              sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              size="medium"
              disabled={saving || !canSaveProduct}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{ px: 2.5, textTransform: 'none', fontWeight: 600 }}
            >
              {saving ? 'Saving…' : 'Save Product'}
            </Button>
          </Box>
        </Paper>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            {productAssistantEnabled && (
              <ProductAssistantPanel
                initialInput={formData.name}
                canUseAssistant={canSaveProduct}
                onApplyResult={applyAssistantResult}
              />
            )}

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

            {pricingCapability && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 0.5 }}>
                  {pricingEnabled ? 'Pricing & Tax' : 'Selling Price'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {pricingEnabled
                    ? 'Set the item price and tax together. The estimate below uses the active sale price when a sale is live.'
                    : 'A selling price is required while ecommerce is enabled, even when price presentation is hidden.'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="MRP *"
                      type="number"
                      InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                      inputProps={{ step: '0.01', min: 0 }}
                      value={formData.price}
                      onChange={(e) => setField('price', e.target.value)}
                      error={Boolean(errors.price)}
                      helperText={errors.price}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Sale Price"
                      type="number"
                      InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                      inputProps={{ step: '0.01', min: 0 }}
                      value={formData.salePrice}
                      onChange={(e) => setField('salePrice', e.target.value)}
                      error={Boolean(errors.salePrice)}
                      helperText={
                        errors.salePrice ||
                        (hasValidDiscount
                          ? `Discount: ${formatPrice(discountAmount)} (${discountPercent}% OFF)`
                          : 'Must be less than MRP')
                      }
                      FormHelperTextProps={{
                        sx: hasValidDiscount && !errors.salePrice
                          ? { color: 'success.main', fontWeight: 600 }
                          : {},
                      }}
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
                {pricingEnabled && (
                  <TaxConfigSection
                    taxConfig={formData.taxConfig}
                    basePrice={previewPrice}
                    priceLabel={previewPriceLabel}
                    setTaxConfig={(val) => setField('taxConfig', val)}
                    globalSettings={settings?.tax || {}}
                    formatPrice={formatPrice}
                    disabled={!canSaveProduct}
                    error={errors.taxConfig}
                  />
                )}
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

          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Storefront
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel id="product-storefront-state-label">Storefront state</InputLabel>
                <Select
                  value={getProductStorefrontState(formData)}
                  labelId="product-storefront-state-label"
                  label="Storefront state"
                  onChange={(event) => {
                    const storefrontFields = getProductStorefrontFields(event.target.value);
                    setFormData((current) => ({ ...current, ...storefrontFields }));
                  }}
                >
                  {Object.values(PRODUCT_STOREFRONT_STATES).map((state) => (
                    <MenuItem key={state} value={state} disabled={isNew && state === PRODUCT_STOREFRONT_STATES.ARCHIVED}>
                      {PRODUCT_STOREFRONT_STATE_LABELS[state]}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{getProductStorefrontStateHelp(getProductStorefrontState(formData))}</FormHelperText>
              </FormControl>

              <FormControl fullWidth margin="normal" error={Boolean(errors.type)}>
                <InputLabel id="product-type-label">Product Type</InputLabel>
                <Select
                  labelId="product-type-label"
                  disabled={saving || !canSaveProduct}
                  value={formData.type}
                  label="Product Type"
                  onChange={(e) => {
                    const newType = e.target.value;
                    if (newType !== 'variable' && variantCount > 0) { notify('Remove all variants, including inactive ones, before changing to Simple or Combo.', 'warning'); return; }
                    if (newType !== 'combo' && dbProduct?.comboItems?.length > 0) { notify('Clear the bundle items before changing this product type.', 'warning'); return; }
                    setField('type', newType);
                  }}
                >
                  <MenuItem value="simple">Simple Product</MenuItem>
                  <MenuItem value="variable">Variable Product</MenuItem>
                  <MenuItem value="combo">Combo / Bundle</MenuItem>
                </Select>
                {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
                <FormHelperText>{formData.type === 'variable' ? 'Customers choose a variant. Manage prices and stock per combination below.' : formData.type === 'combo' ? 'Bundle existing products. Stock depends on the included products.' : 'One version with its own price and stock quantity.'}</FormHelperText>
              </FormControl>
              {formData.type === 'simple' && variantCount > 0 && <Alert severity="warning" action={<Button onClick={() => setField('type', 'variable')} disabled={!canSaveProduct}>Use Variable Product</Button>}>This product has existing variants. Select Variable Product and save to manage them.</Alert>}

            </Paper>

            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Categories &amp; Brand
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

              {brandsEnabled && (
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
              )}
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
                <UnitSelector
                  value={formData.unit}
                  onChange={(val) => setField('unit', val)}
                  error={Boolean(errors.unit)}
                  helperText={errors.unit || 'Used in storefront pricing and quantity display'}
                />

                <TextField
                  fullWidth
                  label={formData.type === 'variable' ? 'Total variant stock' : 'Stock Quantity *'}
                  type="number"
                  margin="normal"
                  inputProps={{ min: 0 }}
                  value={formData.type === 'variable' ? variantStockTotal : formData.quantity}
                  InputProps={{ readOnly: formData.type === 'variable' || variantCount > 0 }}
                  onChange={(e) => setField('quantity', e.target.value)}
                  error={Boolean(errors.quantity)}
                  helperText={errors.quantity || (formData.type === 'variable' ? 'Calculated from active variants. Set each combination’s stock below; no variants means 0 stock.' : variantCount > 0 ? 'Existing variants manage stock. Save this product as Variable Product.' : 'Stock for this single product.')}
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

            {shippingCapability && (
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
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.packingMode === 'separate'}
                          onChange={(e) => setField('packingMode', e.target.checked ? 'separate' : 'standard')}
                        />
                      }
                      label="Ship each unit separately (never combine in a single box)"
                      sx={{ mb: 1, display: 'block' }}
                    />
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
                      error={Boolean(errors.weightGrams)}
                      helperText={errors.weightGrams || "Actual product weight without packaging."}
                    />
                    <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }}>Dimensions (cm)</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Variants inherit absent measurements from base product.
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                      <TextField
                        fullWidth label="Length" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.lengthCm}
                        onChange={(e) => setField('lengthCm', e.target.value)}
                        error={Boolean(errors.lengthCm)}
                        helperText={errors.lengthCm}
                      />
                      <TextField
                        fullWidth label="Breadth" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.breadthCm}
                        onChange={(e) => setField('breadthCm', e.target.value)}
                        error={Boolean(errors.breadthCm)}
                        helperText={errors.breadthCm}
                      />
                      <TextField
                        fullWidth label="Height" type="number" size="small"
                        inputProps={{ min: 0, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }}
                        value={formData.heightCm}
                        onChange={(e) => setField('heightCm', e.target.value)}
                        error={Boolean(errors.heightCm)}
                        helperText={errors.heightCm}
                      />
                    </Box>

                    {/* Live volumetric weight preview */}
                    {Boolean(formData.lengthCm && formData.breadthCm && formData.heightCm) && (
                      (() => {
                        const volWeight = Math.ceil(
                          (Number(formData.lengthCm) * Number(formData.breadthCm) * Number(formData.heightCm)) / (Number(settings?.shipping?.volumetricDivisor) || 5000) * 1000
                        );
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
                              Estimated chargeable weight: {chargeable} g
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
        </Grid>

        {(isNew || dbProduct?.type !== 'variable') && formData.type === 'variable' && (
          <Paper variant="outlined" sx={{ p: 3, mt: 3 }}>
            <Typography variant="h6" fontWeight={700}>Attributes and variants</Typography>
            <Typography variant="body2" color="text.secondary">Save the product first. You can then choose or create attributes, add their values, and generate variants.</Typography>
          </Paper>
        )}

        {/* Variant operations require the Variable type to be saved first. */}
        {!isNew && formData.type === 'variable' && dbProduct?.type === 'variable' && (
          <Box onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); } }}>
            <VariantsPanel 
              pricingEnabled={pricingCapability}
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
          </Box>
        )}

        {/* Custom Tabs panel — only after product is saved */}
        {!isNew && (
          <Box onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); } }}>
            <ProductCustomTabs
              productId={id}
              canEdit={canUpdateProducts}
            />
          </Box>
        )}

        {/* SEO Configuration — always last, even after Attributes and Variants */}
        {seoEnabled && (
          <Paper sx={{ p: 3, mt: 3 }}>
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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr)' }, gap: 3, alignItems: 'start' }}>
              <Box>
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

              </Box>
              <Box sx={{ mt: { xs: 0, md: 2 } }}>
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

              <Box sx={{ mt: { xs: 0, md: 2 }, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e0e0e0', overflowWrap: 'anywhere' }}>
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
            </Box>
          </Paper>
        )}
      </form>
    </Box>
  );
};


export default ProductEditPage;
