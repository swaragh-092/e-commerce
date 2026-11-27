import { getDesignPageControlSchema } from '../../utils/designRegistry';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
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
import { formatSeoTitle } from '../../utils/seo/formatSeoTitle';
import { validateSchemaOverride } from '../../utils/seo/schemaOverride';
import { getProductShareImage } from '../../utils/seo/productShareImage';
import SchemaOverrideField from '../../components/admin/SchemaOverrideField';
import { formatOpenEndedDateRange } from '../../utils/dates';
import ProductTagsInput from '../../components/admin/ProductTagsInput';
import ProductCustomTabs from '../../components/admin/ProductCustomTabs';
import ProductComboBuilder from '../../components/admin/ProductComboBuilder';
import ProductRelatedPicker from '../../components/admin/ProductRelatedPicker';
import TaxConfigSection from '../../components/admin/ProductTaxConfig';
import VariantsPanel from '../../components/admin/ProductVariantsPanel';
import InventoryStockSummary from '../../components/admin/InventoryStockSummary';
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
  if ((formData.tags || []).length > 50 || (formData.tags || []).some((tag) => !tag.trim() || tag.length > 100 || /[\p{Cc}\p{Cf},]/u.test(tag))) {
    errs.tags = 'Use up to 50 tags, each with 1–100 characters and no commas or control characters.';
  }
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

const editorPanelSx = { p: { xs: 2, sm: 3 }, borderRadius: 2, minWidth: 0 };

const editorSection = (id, label) => ({
  component: 'section',
  id: `product-edit-${id}`,
  'aria-label': label,
  'data-product-edit-section': id,
  tabIndex: -1,
});

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
  const location = useLocation();
  const inventoryVariantId = new URLSearchParams(location.search).get('variantId');
  const returnTo = location.state?.returnTo || '/admin/products';
  const { notify, confirm } = useNotification();
  const { settings } = useSettings();
  const { currency, symbol, formatPrice } = useCurrency();
  const { hasPermission } = useAuth();
  const isNew = !id || id === 'new';
  const { generateProductSKU, generateVariantSKU } = useSKUGenerator();
  const sales = settings?.sales || {};
  const canCreateProducts = hasPermission(PERMISSIONS.PRODUCTS_CREATE);
  const canUpdateProducts = hasPermission(PERMISSIONS.PRODUCTS_UPDATE);
  const canReadTags = hasPermission(PERMISSIONS.TAGS_READ);
  const canManageTags = hasPermission(PERMISSIONS.TAGS_MANAGE);
  const tagsEnabled = useFeature('tags');
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
    costPrice: '',
    salePrice: '',
    saleStartAt: '',
    saleEndAt: '',
    saleLabel: '',
    quantity: '',
    status: 'draft',
    storefrontLayout: null,
    type: 'simple',
    isEnabled: true,
    isFeatured: false,
    categoryIds: [],
    brandId: '',
    tags: [],
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
    schemaOverride: '',
    ogImage: '',
  });
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [saleLabels, setSaleLabels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [productLoading, setProductLoading] = useState(!isNew);
  const [productLoadError, setProductLoadError] = useState(false);
  const [loadedProductId, setLoadedProductId] = useState(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [ogPickerOpen, setOgPickerOpen] = useState(false);
  const [dbProduct, setDbProduct] = useState(null);
  const [inventoryVariants, setInventoryVariants] = useState([]);
  const [variantCount, setVariantCount] = useState(0);
  const [variantStockTotal, setVariantStockTotal] = useState(0);
  const [globalPrimaryVersion, setGlobalPrimaryVersion] = useState(0);
  const initialFormRef = useRef(null);
  const editorRef = useRef(null);
  const actionBarRef = useRef(null);
  const [activeSection, setActiveSection] = useState('basic-info');
  const editorReady = isNew || (!productLoading && !productLoadError && loadedProductId === id);

  useEffect(() => {
    if (!editorReady) return undefined;
    const editor = editorRef.current;
    const bar = actionBarRef.current;
    let frame = 0;

    const updateSection = () => {
      frame = 0;
      const sections = Array.from(editor.querySelectorAll('[data-product-edit-section]'));
      const top = bar.getBoundingClientRect().bottom + 28;
      const height = document.documentElement.scrollHeight;
      const atBottom = height > window.innerHeight && window.scrollY + window.innerHeight >= height - 2;
      const focusedSection = document.activeElement?.closest('[data-product-edit-section="storefront"]');
      const storefrontBounds = focusedSection?.getBoundingClientRect();
      const storefrontFocused = storefrontBounds && storefrontBounds.top <= top && storefrontBounds.bottom > top;
      const current = atBottom
        ? sections.at(-1)
        : storefrontFocused ? focusedSection : sections.reverse().find((section) => section.getBoundingClientRect().top <= top);
      setActiveSection(current?.dataset.productEditSection || 'basic-info');
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateSection);
    };
    const measureBar = () => {
      editor.style.setProperty('--editor-action-height', `${bar.offsetHeight}px`);
      scheduleUpdate();
    };

    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measureBar) : null;
    observer?.observe(bar);
    editor.querySelectorAll('[data-product-edit-section]').forEach((section) => observer?.observe(section));
    measureBar();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', measureBar);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', measureBar);
      window.cancelAnimationFrame(frame);
    };
  }, [editorReady, id, formData.type, pricingCapability, shippingCapability, seoEnabled]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setProductLoading(!isNew);
      setProductLoadError(false);
      try {
        const catRes = await getCategoryTree();
        if (!active) return;
        setCategories(catRes?.data || []);

        if (brandsEnabled) {
          const brandRes = await brandService.getBrands({ limit: 100, isActive: 'true' });
          if (!active) return;
          setBrands(brandRes?.data?.data || []);
        } else {
          setBrands([]);
        }

        try {
          const labelsRes = await getSaleLabels();
          if (!active) return;
          const fetchedLabels = labelsRes.data?.data || [];
          setSaleLabels(fetchedLabels.filter(l => l.isActive));
        } catch (e) {
          console.error('Failed to load sale labels', e);
        }

        if (!isNew) {
          const prodRes = await getProductById(id);
          if (!active) return;
          if (!prodRes?.data) throw new Error('Product not found');
          if (prodRes?.data) {
            const p = prodRes.data;

            setDbProduct(p);

            const activeVariants = Array.isArray(p.variants) ? p.variants.filter((variant) => variant?.isActive !== false) : [];
            const nextVariantStockTotal = activeVariants.reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0);
            setInventoryVariants(p.variants || []);
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
              costPrice: p.costPrice ?? '',
              salePrice: p.salePrice || '',
              saleStartAt: toDateTimeLocal(p.saleStartAt),
              saleEndAt: toDateTimeLocal(p.saleEndAt),
              saleLabel: p.saleLabel || '',
              quantity: p.type === 'variable' ? nextVariantStockTotal : (p.quantity || 0),
              status: p.status || 'draft',
              storefrontLayout: p.storefrontLayout ?? null,
              type: p.type || 'simple',
              isEnabled: p.isEnabled ?? true,
              isFeatured: p.isFeatured ?? false,
              categoryIds: p.categories?.map((c) => c.id) || [],
              brandId: p.brandId || '',
              tags: p.tags?.map((tag) => tag.name) || [],
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
              schemaOverride: p.schemaOverride || '',
              ogImage: p.ogImage || '',
            };
            setFormData(loadedFormData);
            setLoadedProductId(id);
            initialFormRef.current = JSON.stringify(loadedFormData);
          }
        }
      } catch (err) {
        if (!active) return;
        setProductLoadError(true);
        notify('Failed to load product data.', 'error');
      } finally {
        if (active) setProductLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, isNew, brandsEnabled, loadVersion]);

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
        navigate(returnTo);
      }
    } else {
      navigate(returnTo);
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
        navigate(returnTo);
      }
    } else {
      navigate(returnTo);
    }
  };

  const setField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const priceNum = Number(formData.price);
  const shareImage = getProductShareImage(formData);
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

  const handleVariantStockChange = useCallback((total, count, fallbackQuantity, totalCount, rows) => {
    setVariantStockTotal(total);
    if (totalCount !== undefined) setVariantCount(totalCount);
    if (rows) setInventoryVariants(rows);
    if (count > 0 || totalCount > 0) {
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

    const effectiveQuantity = formData.type === 'variable' ? variantStockTotal : formData.quantity;
    const errs = validate({ ...formData, quantity: effectiveQuantity, _features: { pricing: pricingCapability, shipping: shippingCapability } });
    const schemaError = seoEnabled && validateSchemaOverride(formData.schemaOverride, 'product');
    if (schemaError) errs.schemaOverride = schemaError;

    // Block type change if invariants are violated
    if (!isNew && dbProduct && formData.type !== dbProduct.type) {
        if (formData.type !== 'variable' && variantCount > 0) {
            errs.type = 'Remove all variants, including inactive ones, before changing to Simple or Combo.';
        }
        if (formData.type !== 'combo' && dbProduct.comboItems?.length > 0) {
            errs.type = `Cannot change to ${formData.type} type: this product has combo items. Clear the bundle first.`;
        }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      if (errs.type) notify(errs.type, 'error');
      else notify(`Please fix the following before saving: ${Object.values(errs).join(' ')}`, 'warning');
      return;
    }

    let confirmInventoryReset = false;
    if (!isNew && dbProduct?.type === 'simple' && formData.type !== 'simple' && (Number(dbProduct.quantity || 0) > 0 || (formData.type === 'variable' && variantCount > 0))) {
      const standaloneStock = Number(dbProduct.quantity || 0);
      const legacyVariantMessage = formData.type === 'variable' && variantCount > 0 ? ' Historical variant stock will also be cleared so sold Simple stock cannot become available again.' : '';
      confirmInventoryReset = await confirm({ title: 'Change how stock is managed?', message: `This product has ${standaloneStock} units of standalone stock. Switching type clears that total.${legacyVariantMessage} Set stock on each variant or bundle component afterward; units are not distributed automatically.`, confirmText: 'Change type and clear stock', cancelText: 'Keep editing', severity: 'warning' });
      if (!confirmInventoryReset) return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        sku: formData.sku.trim() || null,
        price: formData.price === '' ? null : Number(formData.price),
        costPrice: formData.costPrice === "" ? null : Number(formData.costPrice),
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
        schemaOverride: formData.schemaOverride.trim() || null,
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
      if (!tagsEnabled || !canManageTags) delete payload.tags;
      if (!seoEnabled) for (const key of ['metaTitle', 'metaDescription', 'metaKeywords', 'ogImage', 'schemaOverride']) delete payload[key];

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
          navigate(returnTo);
          return;
        }

        notify(payload.type === 'variable' ? 'Product saved. Add attributes and create variants in Inventory.' : 'Product created successfully.', 'success');
        initialFormRef.current = JSON.stringify(formData);
        navigate(`/admin/products/${newId}/edit`, { replace: true, state: { returnTo } });
      } else {
        const res = await updateProduct(id, payload);
        if (res?.data) {
          setDbProduct(res.data);
          // The mounted variant panel owns its draft snapshot during parent-only saves.
          // Initialize from the response only when entering the Variable editor.
          if (payload.type === 'variable' && dbProduct?.type !== 'variable') {
            setInventoryVariants(res.data.variants || []);
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
  const storefrontState = getProductStorefrontState(formData);
  const productTypeLabel = formData.type === 'variable' ? 'Variable' : formData.type === 'combo' ? 'Combo' : 'Simple';

  const pricingLabel = pricingEnabled ? 'Pricing & Tax' : 'Selling Price';
  const hasInventorySection = formData.type !== 'combo' || !isNew;
  const inventoryLabel = formData.type === 'variable' ? 'Inventory & Variants' : 'Inventory';
  const sections = [
    ['storefront', 'Storefront', true],
    ['basic-info', 'Basic Info', true],
    ['pricing-tax', pricingLabel, pricingCapability],
    ['media', 'Media', true],
    ['inventory', inventoryLabel, hasInventorySection],
    ['categories', 'Categories & Brand', true],
    ['shipping', 'Shipping & Dimensions', shippingCapability],
    ['custom-tabs', 'Custom Tabs', !isNew],
    ['related-products', 'Related Products', !isNew],
    ['search-social', 'Search & Social', seoEnabled],
  ].filter(([, , visible]) => visible);
  const currentSection = sections.some(([key]) => key === activeSection) ? activeSection : 'basic-info';

  const jumpToSection = (key) => {
    const section = document.getElementById(`product-edit-${key}`);
    if (!section) return;
    setActiveSection(key);
    section.focus({ preventScroll: true });
    section.scrollIntoView({ block: 'start' });
  };

  if (!isNew && productLoadError) {
    return <Box sx={{ p: 3 }}>
      <Alert severity="error" action={<Button color="inherit" onClick={() => setLoadVersion((value) => value + 1)}>Retry</Button>}>
        Failed to load product data. Retry before editing this product.
      </Alert>
      <Button sx={{ mt: 2 }} onClick={() => navigate(returnTo)}>Back to products</Button>
    </Box>;
  }
  if (!isNew && (productLoading || loadedProductId !== id)) {
    return <Box role="status" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, py: 8 }}>
      <CircularProgress size={24} />
      <Typography>Loading product…</Typography>
    </Box>;
  }

  return (
    <Box
      ref={editorRef}
      sx={(theme) => ({
        width: '100%',
        minWidth: 0,
        '--editor-appbar-height': '56px',
        '@media (orientation: landscape)': { '--editor-appbar-height': '48px' },
        [theme.breakpoints.up('sm')]: { '--editor-appbar-height': '64px' },
        '--editor-sticky-offset': 'calc(var(--editor-appbar-height) + var(--editor-action-height, 88px) + 16px)',
        '& [data-product-edit-section]': { scrollMarginTop: 'var(--editor-sticky-offset)' },
      })}
    >
      <form onSubmit={handleSave} noValidate>
        {/* Sticky Action Bar */}
        <Paper
          ref={actionBarRef}
          variant="outlined"
          sx={{
            position: 'sticky',
            top: 'var(--editor-appbar-height)',
            zIndex: 10,
            mb: { xs: 2, md: 3 },
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
            alignItems: 'center',
            gap: { xs: 1.25, sm: 2 },
            bgcolor: 'background.paper',
          }}
        >
          {/* Left: Back button + Breadcrumbs + Title + Badges */}
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 1.5 }}>
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

            <Box sx={{ minWidth: 0 }}>
              <Breadcrumbs
                separator={<NavigateNextIcon sx={{ fontSize: 14 }} />}
                sx={{ fontSize: '0.75rem', mb: 0.25 }}
              >
                <Link
                  to={returnTo}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  Products
                </Link>
                <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {isNew ? 'New Product' : 'Edit'}
                </Typography>
              </Breadcrumbs>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" component="h1" fontWeight={700} sx={{ fontSize: { xs: '1.125rem', sm: '1.375rem' }, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                  {isNew ? 'Create Product' : (formData.name || 'Untitled Product')}
                </Typography>
                <Chip
                  size="small"
                  label={PRODUCT_STOREFRONT_STATE_LABELS[storefrontState].toUpperCase()}
                  color={{ published: 'success', paused: 'warning', draft: 'default', archived: 'default' }[storefrontState]}
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={productTypeLabel}
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
                {isDirty() && (
                  <Chip size="small" variant="outlined" color="warning" label="Unsaved changes" />
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: { xs: 'space-between', md: 'flex-end' }, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 144 }}>
              <InputLabel id="product-storefront-state-label">Storefront state</InputLabel>
              <Select
                value={storefrontState}
                disabled={saving || !canSaveProduct}
                inputProps={{ "aria-describedby": "product-storefront-state-help" }}
                sx={{ minHeight: 44 }}
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
            </FormControl>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCancel}
              disabled={saving}
              sx={{ minHeight: 44 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={saving || !canSaveProduct}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{ minHeight: 44 }}
            >
              {saving ? 'Saving…' : 'Save Product'}
            </Button>
          </Box>
          <TextField
            select
            id="product-edit-section-picker"
            label="Jump to section"
            value={currentSection}
            onChange={(event) => jumpToSection(event.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ display: { xs: 'block', lg: 'none' }, gridColumn: '1 / -1', '& .MuiInputBase-root': { minHeight: 44 } }}
            fullWidth
          >
            {sections.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </TextField>
        </Paper>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            lg: '176px minmax(0, 1fr)',
            xl: '176px minmax(0, 1fr) minmax(260px, 320px)',
          },
          gridTemplateAreas: {
            xs: '"storefront" "content"',
            lg: '"nav storefront" "nav content"',
            xl: '"nav content storefront"',
          },
          gap: 3,
          alignItems: 'start',
        }}>
          <Box
            component="nav"
            aria-label="Product sections"
            sx={{
              display: { xs: 'none', lg: 'grid' },
              gridArea: 'nav',
              gap: 0.5,
              position: 'sticky',
              top: 'var(--editor-sticky-offset)',
              maxHeight: 'calc(100dvh - var(--editor-sticky-offset) - 16px)',
              overflowY: 'auto',
              p: 0.5,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1.5, mb: 0.5 }}>
              On this page
            </Typography>
            {sections.map(([key, label]) => (
              <Button
                key={key}
                href={`#product-edit-${key}`}
                aria-current={currentSection === key ? 'location' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  jumpToSection(key);
                }}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  minHeight: 44,
                  color: currentSection === key ? 'primary.main' : 'text.secondary',
                  bgcolor: currentSection === key ? 'action.selected' : undefined,
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
          <Paper {...editorSection('storefront', 'Storefront')} variant="outlined" sx={{ ...editorPanelSx, gridArea: 'storefront' }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Storefront
            </Typography>
            <Typography id="product-storefront-state-help" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {getProductStorefrontStateHelp(storefrontState)}
            </Typography>
            <FormControlLabel
              control={<Switch checked={formData.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} />}
              disabled={!canSaveProduct}
              label="Featured product"
            />

            <FormControl fullWidth margin="normal" error={Boolean(errors.type)}>
              <InputLabel id="product-type-label">Product Type</InputLabel>
              <Select
                labelId="product-type-label"
                disabled={saving || !canSaveProduct}
                value={formData.type}
                label="Product Type"
                onChange={(e) => {
                  const newType = e.target.value;
                  if (newType !== 'variable' && variantCount > 0 && !(newType === 'simple' && dbProduct?.type === 'simple')) { notify('Remove all variants, including inactive ones, before changing to Simple or Combo.', 'warning'); return; }
                  if (newType !== 'combo' && dbProduct?.comboItems?.length > 0) { notify('Clear the bundle items before changing this product type.', 'warning'); return; }
                  setField('type', newType);
                }}
              >
                <MenuItem value="simple">Simple Product</MenuItem>
                <MenuItem value="variable">Variable Product</MenuItem>
                <MenuItem value="combo">Combo / Bundle</MenuItem>
              </Select>
              {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
              <FormHelperText>{formData.type === 'variable' ? 'Customers choose a variant. Manage each combination in Inventory & Variants.' : formData.type === 'combo' ? 'Bundle existing products. Stock depends on the included products.' : 'One version with its own price and stock quantity.'}</FormHelperText>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel id="storefront-layout-label">Storefront layout</InputLabel>
              <Select
                labelId="storefront-layout-label"
                label="Storefront layout"
                value={formData.storefrontLayout || ''}
                onChange={(event) => setField('storefrontLayout', event.target.value || null)}
              >
                <MenuItem value="">Use store default</MenuItem>
                {getDesignPageControlSchema('product').groups[0].fields[0].options.map(({ value, label }) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {formData.type === 'simple' && variantCount > 0 && <Alert severity="info">This Simple product uses its own stock quantity. Older variant records are retained for existing orders and do not control current stock or alerts.</Alert>}

          </Paper>
          <Box sx={{ display: 'grid', gap: { xs: 2, sm: 3 }, minWidth: 0, gridArea: 'content' }}>
            {productAssistantEnabled && (
              <ProductAssistantPanel
                initialInput={formData.name}
                canUseAssistant={canSaveProduct}
                onApplyResult={applyAssistantResult}
              />
            )}

            <Paper {...editorSection('basic-info', 'Basic Info')} variant="outlined" sx={editorPanelSx}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Basic Info
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' }, gap: 2 }}>
                  <TextField
                    fullWidth
                    label="Product Name *"
                    size="small"
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
                    size="small"
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
                                aria-label="Auto-generate slug from name"
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
                </Box>
                <TextField
                  fullWidth
                  label="Short Description"
                  multiline
                  minRows={2}
                  maxRows={4}
                  size="small"
                  value={formData.shortDescription}
                  onChange={(e) => setField('shortDescription', e.target.value)}
                  error={Boolean(errors.shortDescription)}
                  helperText={errors.shortDescription || `${formData.shortDescription.length} / 500 characters`}
                  inputProps={{ maxLength: 500 }}
                />
                <TextField
                  fullWidth
                  label="Full Description"
                  size="small"
                  multiline
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setField('description', e.target.value)}
                  helperText="Supports HTML formatting"
                />
              </Box>
            </Paper>

            {pricingCapability && (
              <Paper {...editorSection('pricing-tax', pricingLabel)} variant="outlined" sx={editorPanelSx}>
                <Typography variant="h6" component="h2" sx={{ mb: 0.5 }}>
                  {pricingLabel}
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
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Unit Cost"
                      type="number"
                      InputProps={{ startAdornment: <InputAdornment position="start">{symbol}</InputAdornment> }}
                      inputProps={{ step: '0.01', min: 0 }}
                      value={formData.costPrice}
                      onChange={(e) => setField('costPrice', e.target.value)}
                      helperText="Internal cost used for gross margin reports."
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

            <Paper {...editorSection('media', 'Media')} variant="outlined" sx={editorPanelSx}>
              <Typography variant="h6" component="h2" gutterBottom>
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

            {hasInventorySection && (
              <Box {...editorSection('inventory', inventoryLabel)} sx={{ display: 'grid', gap: { xs: 2, sm: 3 }, minWidth: 0 }}>
                {formData.type !== 'combo' && (
                  <Paper variant="outlined" sx={editorPanelSx}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {inventoryLabel}
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
                      InputProps={{ readOnly: formData.type === 'variable' }}
                      onChange={(e) => setField('quantity', e.target.value)}
                      error={Boolean(errors.quantity)}
                      helperText={errors.quantity || (formData.type === 'variable' ? 'Calculated from active variants. Set each combination’s stock below; no variants means 0 stock.' : 'Stock for this single product.')}
                    />
                    <InventoryStockSummary
                      quantity={formData.quantity}
                      reservedQty={dbProduct?.reservedQty}
                      variants={formData.type === 'variable' ? inventoryVariants : []}
                      selectedVariantId={inventoryVariantId}
                      tracksVariants={formData.type === 'variable'}
                      enabled={formData.isEnabled !== false}
                      published={formData.status === 'published'}
                    />
                  </Paper>
                )}

                {/* Combo Builder — only after the product type is saved as combo */}
                {!isNew && formData.type === 'combo' && dbProduct?.type !== 'combo' && (
                  <Alert severity="info">
                    Save the product as a combo before adding bundle items.
                  </Alert>
                )}

                {!isNew && formData.type === 'combo' && dbProduct?.type === 'combo' && (
                  <Paper variant="outlined" sx={editorPanelSx}>
                    <ProductComboBuilder
                      productId={id}
                      canEdit={canUpdateProducts}
                      onSuggestedPrice={(price) => setField('price', price)}
                    />
                  </Paper>
                )}
                {(isNew || dbProduct?.type !== 'variable') && formData.type === 'variable' && (
                  <Paper variant="outlined" sx={editorPanelSx}>
                    <Typography variant="h6" component="h3" fontWeight={700}>Attributes and variants</Typography>
                    <Typography variant="body2" color="text.secondary">Save the product first. You can then choose or create attributes, add their values, and generate variants.</Typography>
                  </Paper>
                )}

                {/* Variant operations require the Variable type to be saved first. */}
                {!isNew && formData.type === 'variable' && dbProduct?.type === 'variable' && (
                  <Box onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); } }}>
                    <VariantsPanel
                      pricingEnabled={pricingEnabled}
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
              </Box>
            )}

            <Box {...editorSection('categories', 'Categories & Brand')} sx={{ minWidth: 0 }}>
              <Paper variant="outlined" sx={editorPanelSx}>
                <Typography variant="h6" component="h2" gutterBottom>
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


                {tagsEnabled && canReadTags && <ProductTagsInput value={formData.tags} onChange={(tags) => setField('tags', tags)} disabled={!canSaveProduct || !canManageTags} error={errors.tags} />}

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
            </Box>

            {shippingCapability && (
              <Paper {...editorSection('shipping', 'Shipping & Dimensions')} variant="outlined" sx={editorPanelSx}>
                <Typography variant="h6" component="h2" gutterBottom>
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
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Turn this on for physical products, including those with free shipping. Turn it off for products fulfilled without shipping.
                </Typography>

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

            {/* Custom Tabs panel — only after product is saved */}
            {!isNew && (
              <Box {...editorSection('custom-tabs', 'Custom Tabs')} sx={{ minWidth: 0 }} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); } }}>
                <ProductCustomTabs
                  productId={id}
                  canEdit={canUpdateProducts}
                />
              </Box>
            )}

            {!isNew && (
              <Paper {...editorSection('related-products', 'Related Products')} variant="outlined" sx={editorPanelSx} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
                <ProductRelatedPicker key={id} productId={id} canEdit={canUpdateProducts} />
              </Paper>
            )}

            {/* SEO Configuration — always last, even after Attributes and Variants */}
            {seoEnabled && (
              <Paper {...editorSection('search-social', 'Search & Social')} variant="outlined" sx={editorPanelSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" component="h2">
                    SEO Configuration
                  </Typography>
                  <Chip label="SEO v2" size="small" color="primary" variant="outlined" />
                </Box>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Fine-tune how this product appears in search engines and social media.
                  If left blank, the system will auto-generate metadata.
                </Alert>

                <SchemaOverrideField
                  key={id}
                  kind="product"
                  value={formData.schemaOverride}
                  onChange={(value) => setField('schemaOverride', value)}
                  error={errors.schemaOverride}
                  path={dbProduct?.status === 'published' && dbProduct.isEnabled !== false && dbProduct.slug ? `/products/${encodeURIComponent(dbProduct.slug)}` : null}
                  name={formData.name}
                  description={formData.metaDescription || formData.shortDescription}
                  variants={formData.type === 'variable' ? dbProduct?.variants : undefined}
                />
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)', xl: 'minmax(0, 5fr) minmax(0, 3fr) minmax(0, 4fr)' }, gap: 3, alignItems: 'start' }}>
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
                    {shareImage && (
                      <Box sx={{ mt: 2, position: 'relative', width: 'fit-content' }}>
                        <img
                          src={getMediaUrl(shareImage)}
                          alt="Social share image preview"
                          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid #ddd' }}
                        />
                        {canSaveProduct && formData.ogImage && (
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Use primary product image"
                            sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper', boxShadow: 1 }}
                            onClick={() => setField('ogImage', '')}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                    {!formData.ogImage && (
                      <FormHelperText>The primary product image is used automatically when available.</FormHelperText>
                    )}
                    {!canUploadMedia && !formData.ogImage && (
                      <Typography variant="caption" color="text.secondary">
                        You do not have permission to upload media.
                      </Typography>
                    )}
                    <FormHelperText>Recommended size: 1200x630px</FormHelperText>
                  </Box>

                  <Box sx={{ mt: { xs: 0, md: 2 }, p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowWrap: 'anywhere' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>
                      GOOGLE SEARCH PREVIEW
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'primary.main', fontSize: '18px', '&:hover': { textDecoration: 'underline' }, cursor: 'pointer', mb: 0.5 }}>
                      {formatSeoTitle(formData.metaTitle || formData.name || 'Product Name', settings)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'success.dark', fontSize: '14px', mb: 0.5 }}>
                      {window.location.origin}/product/{formData.slug || 'slug'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '13px', lineHeight: 1.4 }}>
                      {formData.metaDescription || formData.shortDescription || 'Your product description will appear here...'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            )}
          </Box>
        </Box>
      </form>
    </Box>
  );
};


export default ProductEditPage;
