import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  Tab,
  Tabs,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  IconButton,
  Chip,
  FormControlLabel,
  CircularProgress,
  Alert,
  MenuItem,
  Grid
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { useNotification } from '../../context/NotificationContext';
import {
  getShippingProviders,
  updateShippingProvider,
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  getShippingRules,
  createShippingRule,
  updateShippingRule,
  deleteShippingRule,
  testShippingCalculation,
  testShippingProviderConnection,
  getShippingOperations,
  retryShippingOperation,
} from '../../services/adminService';
import { getProducts } from '../../services/productService';
import { useCurrency } from '../../hooks/useSettings';
import TabPanel from '../../components/common/TabPanel';
import { getSettingsGroup, updateSettingsBulk } from '../../services/settingsService';

const ShippingPage = () => {
  const { notify } = useNotification();
  const { symbol, formatPrice } = useCurrency();
  const [tabIndex, setTabIndex] = useState(0);

  // Data states
  const [providers, setProviders] = useState([]);
  const [zones, setZones] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defaultPackage, setDefaultPackage] = useState({ enabled: false, lengthCm: '', breadthCm: '', heightCm: '', emptyWeightGrams: '', maxItems: '', maxContentsWeightGrams: '' });
  const [savingPackage, setSavingPackage] = useState(false);
  const [packageProfiles, setPackageProfiles] = useState([]);
  const [packageProducts, setPackageProducts] = useState([]);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [packageDraft, setPackageDraft] = useState(null);
  const [fitDraft, setFitDraft] = useState({ productId: '', variantId: '', maxQuantity: 1, mixGroup: '' });
  const [deliverySettings, setDeliverySettings] = useState({ pricingMode: '', method: 'flat_rate', flatRate: '', freeThreshold: '', serviceablePincodes: '', blockedPincodes: '' });
  const [savingDelivery, setSavingDelivery] = useState(false);
  const enabledRules = rules.filter((rule) => rule.enabled);
  const setDeliveryField = (key, value) => setDeliverySettings((current) => ({ ...current, [key]: value }));
  const handleSaveDelivery = async () => {
    if (!['standard', 'rules', 'carrier'].includes(deliverySettings.pricingMode)) {
      notify('Choose standard pricing, advanced shipping rules, or carrier-calculated delivery.', 'warning');
      return;
    }
    if (['serviceablePincodes', 'blockedPincodes'].some((key) => deliverySettings[key].trim() && deliverySettings[key].split(',').some((entry) => !/^\d{6}$/.test(entry.trim())))) {
      notify('Enter 6-digit delivery pincodes separated by commas.', 'warning');
      return;
    }
    const keys = deliverySettings.pricingMode !== 'standard' || deliverySettings.method === 'free' ? [] : deliverySettings.method === 'free_above_threshold' ? ['flatRate', 'freeThreshold'] : ['flatRate'];
    if (keys.some((key) => deliverySettings[key] === '' || !Number.isFinite(Number(deliverySettings[key])) || Number(deliverySettings[key]) < 0)) {
      notify('Enter a non-negative delivery fee and minimum order amount.', 'warning');
      return;
    }
    const settings = ['pricingMode', ...(deliverySettings.pricingMode === 'standard' ? ['method'] : []), 'serviceablePincodes', 'blockedPincodes', ...keys].map((key) => ({ group: 'shipping', key, value: keys.includes(key) ? Number(deliverySettings[key]) : deliverySettings[key] }));
    setSavingDelivery(true);
    try {
      await updateSettingsBulk(settings);
      notify('Delivery pricing and coverage saved', 'success');
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Could not save delivery settings', 'error');
    } finally {
      setSavingDelivery(false);
    }
  };
  
  // Test Panel State
  const [testParams, setTestParams] = useState({ pincode: '', subtotal: 0, paymentMethod: 'prepaid', weightGrams: 500 });
  const [testResult, setTestResult] = useState(null);
  const [testingEngine, setTestingEngine] = useState(false);

  // Provider Connection Testing State
  const [testingConnectionId, setTestingConnectionId] = useState(null);
  const [connectionResults, setConnectionResults] = useState({});

  // Failed Operations State
  const [failedOperations, setFailedOperations] = useState([]);
  const [failedOpsLoading, setFailedOpsLoading] = useState(false);
  const [failedOpsTotal, setFailedOpsTotal] = useState(0);
  const [failedOpsPage, setFailedOpsPage] = useState(1);
  const [retryingOpId, setRetryingOpId] = useState(null);
  const [operationStatus, setOperationStatus] = useState('failed');

  // Dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingZone, setEditingZone] = useState(null);
  const [editingRule, setEditingRule] = useState(null);

  // Form states
  const [zoneFormData, setZoneFormData] = useState({ name: '', pincodes: '', enabled: true });
  const EMPTY_RULE_FORM = {
    name: '',
    priority: 100,
    zoneId: '',
    providerId: '',
    rateType: 'flat',
    codAllowed: true,
    enabled: true,
    conditions: '{}',
    // Structured rateConfig — built from these fields on submit
    rc_baseCharge: 0,
    rc_threshold: 0,
    rc_percent: 0,
    rc_firstSlabGrams: 500,
    rc_additionalSlabGrams: 500,
    rc_additionalSlabRate: 0,
    rc_minCharge: 30,
    rc_fuelSurchargePercent: 0,
    rc_freeAboveSubtotal: '',
    rc_zone_same_city: 1.0,
    rc_zone_same_state: 1.3,
    rc_zone_national: 1.6,
    rc_zone_remote: 2.0,
    rc_codFeeType: 'flat',
    rc_codFeeValue: 0,
    rc_codFeeMin: 0,
    cond_weightGte: '',
    cond_weightLte: '',
  };
  const [ruleFormData, setRuleFormData] = useState(EMPTY_RULE_FORM);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [providersRes, zonesRes, rulesRes, shippingSettings, productsRes] = await Promise.all([
        getShippingProviders(),
        getShippingZones(),
        getShippingRules(),
        getSettingsGroup('shipping'),
        getProducts({ page: 1, limit: 1000, status: 'published', include: 'variants' }).catch(() => ({ data: [] })),
      ]);
      setProviders(providersRes.data.data || []);
      setZones(zonesRes.data.data || []);
      setRules(rulesRes.data.data || []);
      setDeliverySettings((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, Array.isArray(shippingSettings[key]) ? shippingSettings[key].join(', ') : shippingSettings[key] ?? previous[key]])));
      setDefaultPackage((previous) => ({ ...previous, ...(shippingSettings.defaultPackage || {}) }));
      setPackageProfiles(Array.isArray(shippingSettings.packageProfiles) ? shippingSettings.packageProfiles : []);
      setPackageProducts((productsRes?.data || []).filter((product) => product.requiresShipping !== false));
    } catch (err) {
      notify('Failed to load shipping data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePackage = async () => {
    const value = { enabled: defaultPackage.enabled };
    for (const key of ['lengthCm', 'breadthCm', 'heightCm', 'emptyWeightGrams', 'maxItems', 'maxContentsWeightGrams']) {
      value[key] = defaultPackage[key] === '' ? null : Number(defaultPackage[key]);
    }
    if (value.enabled && (
      ['lengthCm', 'breadthCm', 'heightCm'].some((key) => !Number.isFinite(value[key]) || value[key] <= 0.5) ||
      value.emptyWeightGrams == null || !Number.isFinite(value.emptyWeightGrams) || value.emptyWeightGrams < 0 ||
      !Number.isSafeInteger(value.maxItems) || value.maxItems < 1 ||
      !Number.isFinite(value.maxContentsWeightGrams) || value.maxContentsWeightGrams <= 0
    )) {
      notify('Enter measured dimensions, empty package weight, and confirmed item and weight capacity.', 'warning');
      return;
    }
    setSavingPackage(true);
    try {
      await updateSettingsBulk([{ group: 'shipping', key: 'defaultPackage', value }]);
      notify('Default package saved', 'success');
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Could not save the default package', 'error');
    } finally {
      setSavingPackage(false);
    }
  };

  const openPackageDialog = (profile = null) => {
    setPackageDraft(profile ? { ...profile, fits: [...(profile.fits || [])] } : {
      id: uuidv4(), name: '', enabled: true, lengthCm: '', breadthCm: '', heightCm: '',
      emptyWeightGrams: '', maxItems: '', maxContentsWeightGrams: '', fits: [],
    });
    setFitDraft({ productId: '', variantId: '', maxQuantity: 1, mixGroup: '' });
    setPackageDialogOpen(true);
  };

  const savePackageProfiles = async (nextProfiles) => {
    setSavingPackage(true);
    try {
      await updateSettingsBulk([{ group: 'shipping', key: 'packageProfiles', value: nextProfiles }]);
      setPackageProfiles(nextProfiles);
      notify('Package types saved', 'success');
      setPackageDialogOpen(false);
    } catch (err) {
      notify(err.response?.data?.error?.message || 'Could not save package types', 'error');
    } finally {
      setSavingPackage(false);
    }
  };

  const savePackageDraft = async () => {
    if (!packageDraft || !packageDraft.name.trim()) {
      notify('Enter a package name.', 'warning');
      return;
    }
    const next = { ...packageDraft };
    delete next.allowMixedContents;
    for (const key of ['lengthCm', 'breadthCm', 'heightCm', 'emptyWeightGrams', 'maxItems', 'maxContentsWeightGrams']) {
      next[key] = Number(next[key]);
    }
    if (['lengthCm', 'breadthCm', 'heightCm'].some((key) => !Number.isFinite(next[key]) || next[key] <= 0.5) ||
      !Number.isFinite(next.emptyWeightGrams) || next.emptyWeightGrams < 0 || !Number.isSafeInteger(next.maxItems) || next.maxItems < 1 ||
      !Number.isFinite(next.maxContentsWeightGrams) || next.maxContentsWeightGrams <= 0 || next.fits.length === 0) {
      notify('Enter measured package values and at least one confirmed product fit.', 'warning');
      return;
    }
    await savePackageProfiles([...packageProfiles.filter((profile) => profile.id !== next.id), next]);
  };

  const addFitToDraft = () => {
    if (!fitDraft.productId || !Number.isSafeInteger(Number(fitDraft.maxQuantity)) || Number(fitDraft.maxQuantity) < 1) {
      notify('Choose a product and enter the confirmed maximum quantity per package.', 'warning');
      return;
    }
    const fit = { productId: fitDraft.productId, ...(fitDraft.variantId ? { variantId: fitDraft.variantId } : {}), maxQuantity: Number(fitDraft.maxQuantity), ...(fitDraft.mixGroup.trim() ? { mixGroup: fitDraft.mixGroup.trim() } : {}) };
    const key = `${fit.productId}:${fit.variantId || ''}`;
    if (packageDraft.fits.some((row) => `${row.productId}:${row.variantId || ''}` === key)) {
      notify('That product/variant already has a fit rule in this package.', 'warning');
      return;
    }
    setPackageDraft((current) => ({ ...current, fits: [...current.fits, fit] }));
    setFitDraft({ productId: '', variantId: '', maxQuantity: 1, mixGroup: '' });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  const handleTestConnection = async (provider) => {
    setTestingConnectionId(provider.id);
    try {
      const res = await testShippingProviderConnection(provider.id);
      const data = res.data?.data || {};
      setConnectionResults((prev) => ({
        ...prev,
        [provider.id]: data,
      }));
      if (data.success) {
        notify(data.message || `Connected to ${provider.name} successfully`, 'success');
      } else {
        notify(data.message || `Failed to connect to ${provider.name}`, 'error');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Connection test failed';
      setConnectionResults((prev) => ({
        ...prev,
        [provider.id]: { success: false, message: errMsg },
      }));
      notify(errMsg, 'error');
    } finally {
      setTestingConnectionId(null);
    }
  };

  const fetchFailedOperations = async (page = 1, status = operationStatus) => {
    setFailedOpsLoading(true);
    try {
      const res = await getShippingOperations({ page, limit: 10, status });
      setFailedOperations(res.data?.data || []);
      setFailedOpsTotal(res.data?.meta?.total || 0);
      setFailedOpsPage(page);
    } catch (err) {
      notify('Failed to load shipping operations', 'error');
    } finally {
      setFailedOpsLoading(false);
    }
  };

  const handleRetryOperation = async (opId) => {
    setRetryingOpId(opId);
    try {
      const res = await retryShippingOperation(opId);
      if (res.data?.data?.success) {
        notify('Carrier booking completed successfully.', 'success');
      } else {
        notify(res.data?.data?.error || 'Retry was queued or is still processing. Check the operation status before trying again.', 'warning');
      }
      fetchFailedOperations(failedOpsPage);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to retry operation', 'error');
    } finally {
      setRetryingOpId(null);
    }
  };

  useEffect(() => {
    if (tabIndex === 4) {
      fetchFailedOperations(1, 'failed');
    }
  }, [tabIndex]);

  // --- Providers ---
  const handleToggleProvider = async (provider) => {
    if (provider.isDefault && provider.enabled) {
      notify('Cannot disable the default shipping provider. Please set another provider as default first.', 'warning');
      return;
    }
    try {
      await updateShippingProvider(provider.id, { enabled: !provider.enabled });
      notify('Provider status updated', 'success');
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update provider', 'error');
    }
  };

  const handleSetDefaultProvider = async (provider) => {
    try {
      await updateShippingProvider(provider.id, { isDefault: true, enabled: true });
      notify(`"${provider.name}" is now the default shipping provider`, 'success');
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to set default provider', 'error');
    }
  };

  const handleEditProvider = (provider) => {
    setEditingProvider({
      ...provider,
      pickupPincode: provider.settings?.pickupPincode || '',
      pickupLocationName: provider.settings?.pickupLocationName || '',
      webhookHeaderName: provider.settings?.webhookHeaderName || 'x-api-key',
      webhookSecret: '',
    });
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    try {
      const payload = { 
        name: editingProvider.name,
        isDefault: editingProvider.isDefault,
        supportsCod: editingProvider.supportsCod,
        settings: {
          ...(editingProvider.settings || {}),
          pickupPincode: editingProvider.pickupPincode?.trim() || null,
          pickupLocationName: editingProvider.pickupLocationName?.trim() || null,
          webhookHeaderName: editingProvider.webhookHeaderName?.trim().toLowerCase() || 'x-api-key',
        },
      };

      if (editingProvider.credEmail && editingProvider.credPassword) {
        payload.credentials = {
          email: editingProvider.credEmail,
          password: editingProvider.credPassword
        };
      }

      if (editingProvider.webhookSecret?.trim()) {
        payload.webhookSecret = editingProvider.webhookSecret.trim();
      }

      await updateShippingProvider(editingProvider.id, payload);
      notify('Provider updated successfully', 'success');
      setProviderDialogOpen(false);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update provider', 'error');
    }
  };

  // --- Zones ---
  const handleOpenZoneDialog = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setZoneFormData({
        name: zone.name,
        pincodes: zone.pincodes ? zone.pincodes.join(', ') : '',
        enabled: zone.enabled
      });
    } else {
      setEditingZone(null);
      setZoneFormData({ name: '', pincodes: '', enabled: true });
    }
    setZoneDialogOpen(true);
  };

  const handleSaveZone = async () => {
    try {
      const payload = {
        name: zoneFormData.name,
        pincodes: zoneFormData.pincodes.split(',').map(p => p.trim()).filter(Boolean),
        enabled: zoneFormData.enabled
      };
      
      if (editingZone) {
        await updateShippingZone(editingZone.id, payload);
        notify('Zone updated successfully', 'success');
      } else {
        await createShippingZone(payload);
        notify('Zone created successfully', 'success');
      }
      setZoneDialogOpen(false);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save zone', 'error');
    }
  };

  const handleDeleteZone = async (id) => {
    if (!window.confirm('Are you sure you want to delete this zone?')) return;
    try {
      await deleteShippingZone(id);
      notify('Zone deleted successfully', 'success');
      fetchData();
    } catch (err) {
      notify('Failed to delete zone', 'error');
    }
  };

  // --- Rules ---
  const handleOpenRuleDialog = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      const rc = rule.rateConfig || {};
      const cond = rule.conditions || {};
      const zm = rc.zoneMultipliers || {};
      setRuleFormData({
        name:                    rule.name,
        priority:                rule.priority,
        zoneId:                  rule.zoneId || '',
        providerId:              rule.providerId || '',
        rateType:                rule.rateType,
        codAllowed:              rule.codAllowed,
        enabled:                 rule.enabled,
        conditions:              JSON.stringify(cond, null, 2),
        rc_baseCharge:           rc.baseCharge ?? rc.flatRate ?? rc.amount ?? 0,
        rc_threshold:            rc.threshold ?? 0,
        rc_percent:              rc.percent ?? 0,
        rc_firstSlabGrams:       rc.firstSlabGrams ?? 500,
        rc_additionalSlabGrams:  rc.additionalSlabGrams ?? 500,
        rc_additionalSlabRate:   rc.additionalSlabRate ?? 0,
        rc_minCharge:            rc.minCharge ?? 30,
        rc_fuelSurchargePercent: rc.fuelSurchargePercent ?? 0,
        rc_freeAboveSubtotal:    rc.freeAboveSubtotal ?? '',
        rc_zone_same_city:       zm.same_city  ?? 1.0,
        rc_zone_same_state:      zm.same_state ?? 1.3,
        rc_zone_national:        zm.national   ?? 1.6,
        rc_zone_remote:          zm.remote     ?? 2.0,
        rc_codFeeType:           rc.codFeeType  ?? 'flat',
        rc_codFeeValue:          rc.codFeeValue ?? 0,
        rc_codFeeMin:            rc.codFeeMin   ?? 0,
        cond_weightGte:          cond.weightGte ?? '',
        cond_weightLte:          cond.weightLte ?? '',
      });
    } else {
      setEditingRule(null);
      setRuleFormData({ ...EMPTY_RULE_FORM });
    }
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    const priority = parseInt(ruleFormData.priority, 10);
    if (isNaN(priority)) { notify('Priority must be a valid number', 'error'); return; }
    if (!ruleFormData.name.trim()) { notify('Rule name is required', 'error'); return; }

    // Build rateConfig from structured fields
    const rateConfig = {};
    const rt = ruleFormData.rateType;

    if (rt === 'flat') {
      rateConfig.amount    = parseFloat(ruleFormData.rc_baseCharge) || 0;
      rateConfig.baseCharge = rateConfig.amount;
    } else if (rt === 'free_above_threshold') {
      rateConfig.threshold = parseFloat(ruleFormData.rc_threshold) || 0;
      rateConfig.amount    = parseFloat(ruleFormData.rc_baseCharge) || 0;
    } else if (rt === 'percent_of_order') {
      rateConfig.percent = parseFloat(ruleFormData.rc_percent) || 0;
    } else if (rt === 'per_kg_slab' || rt === 'volumetric') {
      rateConfig.baseCharge           = parseFloat(ruleFormData.rc_baseCharge) || 0;
      rateConfig.firstSlabGrams       = parseFloat(ruleFormData.rc_firstSlabGrams) || 500;
      rateConfig.additionalSlabGrams  = parseFloat(ruleFormData.rc_additionalSlabGrams) || 500;
      rateConfig.additionalSlabRate   = parseFloat(ruleFormData.rc_additionalSlabRate) || 0;
      rateConfig.minCharge            = parseFloat(ruleFormData.rc_minCharge) || 0;
      rateConfig.fuelSurchargePercent = parseFloat(ruleFormData.rc_fuelSurchargePercent) || 0;
      rateConfig.zoneMultipliers = {
        same_city:  parseFloat(ruleFormData.rc_zone_same_city)  || 1.0,
        same_state: parseFloat(ruleFormData.rc_zone_same_state) || 1.3,
        national:   parseFloat(ruleFormData.rc_zone_national)   || 1.6,
        remote:     parseFloat(ruleFormData.rc_zone_remote)     || 2.0,
      };
    }

    if (ruleFormData.rc_freeAboveSubtotal !== '' && ruleFormData.rc_freeAboveSubtotal !== null) {
      rateConfig.freeAboveSubtotal = parseFloat(ruleFormData.rc_freeAboveSubtotal);
    }

    // COD fee config (all non-free rate types may carry COD fee)
    if (rt !== 'free') {
      rateConfig.codFeeType  = ruleFormData.rc_codFeeType;
      rateConfig.codFeeValue = parseFloat(ruleFormData.rc_codFeeValue) || 0;
      rateConfig.codFeeMin   = parseFloat(ruleFormData.rc_codFeeMin) || 0;
    }

    // Build conditions from structured + raw JSON
    let parsedConditions = {};
    try {
      parsedConditions = JSON.parse(ruleFormData.conditions || '{}');
    } catch {
      notify('Conditions must be valid JSON', 'error');
      return;
    }
    if (ruleFormData.cond_weightGte !== '') {
      const weightGte = parseFloat(ruleFormData.cond_weightGte);
      if (!isNaN(weightGte)) parsedConditions.weightGte = weightGte;
    }
    if (ruleFormData.cond_weightLte !== '') {
      const weightLte = parseFloat(ruleFormData.cond_weightLte);
      if (!isNaN(weightLte)) parsedConditions.weightLte = weightLte;
    }

    try {
      const payload = {
        name:       ruleFormData.name,
        priority,
        zoneId:     ruleFormData.zoneId     || null,
        providerId: ruleFormData.providerId || null,
        rateType:   ruleFormData.rateType,
        rateConfig,
        codAllowed: ruleFormData.codAllowed,
        enabled:    ruleFormData.enabled,
        conditions: parsedConditions,
      };
      if (editingRule) {
        await updateShippingRule(editingRule.id, payload);
        notify('Rule updated successfully', 'success');
      } else {
        await createShippingRule(payload);
        notify('Rule created successfully', 'success');
      }
      setRuleDialogOpen(false);
      fetchData();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save rule', 'error');
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await deleteShippingRule(id);
      notify('Rule deleted successfully', 'success');
      fetchData();
    } catch (err) {
      notify('Failed to delete rule', 'error');
    }
  };

  const handleRunTest = async () => {
    if (!testParams.pincode) {
      notify('Please enter a delivery pincode to test', 'warning');
      return;
    }
    setTestingEngine(true);
    setTestResult(null);
    try {
      const payload = {
        pincode: testParams.pincode,
        subtotal: Number(testParams.subtotal) || 0,
        paymentMethod: testParams.paymentMethod || 'prepaid',
        weightGrams: Number(testParams.weightGrams) || 500,
      };
      const res = await testShippingCalculation(payload);
      setTestResult(res.data.data);
      notify('Test completed successfully', 'success');
    } catch (err) {
      setTestResult({ error: err.response?.data?.message || err.message });
      notify(err.response?.data?.message || 'Failed to run test', 'error');
    } finally {
      setTestingEngine(false);
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h1" fontWeight={700}>
          Shipping Management
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs variant="scrollable" scrollButtons="auto" value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab value={0} id="shipping-tab-0" aria-controls="shipping-tabpanel-0" label="Delivery pricing & coverage" />
          <Tab value={1} id="shipping-tab-1" aria-controls="shipping-tabpanel-1" label="Shipping Providers" />
          <Tab value={2} id="shipping-tab-2" aria-controls="shipping-tabpanel-2" label="Rate Zones" />
          <Tab value={3} id="shipping-tab-3" aria-controls="shipping-tabpanel-3" label="Shipping Rules" />
          <Tab value={4} id="shipping-tab-4" aria-controls="shipping-tabpanel-4" label="Test Panel" />
          <Tab value={5} id="shipping-tab-5" aria-controls="shipping-tabpanel-5" label="Operations & Failures" />
          <Tab value={6} id="shipping-tab-6" aria-controls="shipping-tabpanel-6" label="Packaging" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabIndex} index={0} idPrefix="shipping">
            <Typography variant="subtitle1" fontWeight={600}>Customer delivery fee</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Choose one checkout policy. Standard and rules charge your configured customer fee; carrier-calculated uses a live Shiprocket quote for a supported single parcel.</Typography>
            {!deliverySettings.pricingMode && <Alert severity="warning" sx={{ mb: 2 }}>Existing pricing is preserved until you choose and save a pricing policy. Previously, matching rules could override the standard fee.</Alert>}
            {deliverySettings.pricingMode === 'rules' && <Alert severity={enabledRules.length ? 'info' : 'warning'} sx={{ mb: 2 }}>Only matching advanced rules set the customer fee. Orders without a matching rule cannot proceed. {enabledRules.length} rule(s) enabled.<Button size="small" onClick={() => setTabIndex(3)}>Manage rules</Button></Alert>}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <TextField select label="Customer delivery pricing" value={deliverySettings.pricingMode} disabled={savingDelivery} onChange={(event) => setDeliveryField('pricingMode', event.target.value)} helperText="Choose one policy; only the selected policy sets the delivery line at checkout.">
                <MenuItem value="" disabled>Choose a pricing policy</MenuItem>
                <MenuItem value="standard">Standard pricing — fixed fee or free delivery</MenuItem>
                <MenuItem value="rules">Advanced shipping rules — regional or weight-based fees</MenuItem>
                <MenuItem value="carrier">Carrier-calculated — live Shiprocket parcel rates</MenuItem>
              </TextField>
              {deliverySettings.pricingMode === 'carrier' && <Alert severity="warning">Checkout will block orders that need multiple parcels until Shiprocket confirms the MPS API request for your account. Account activation alone does not confirm the API flow.</Alert>}
              {deliverySettings.pricingMode === 'standard' && <TextField select label="Delivery fee method" value={deliverySettings.method} disabled={savingDelivery} onChange={(event) => setDeliveryField('method', event.target.value)}>
                <MenuItem value="flat_rate">Fixed fee per order</MenuItem>
                <MenuItem value="free_above_threshold">Free above an order amount</MenuItem>
                <MenuItem value="free">Always free for customers</MenuItem>
              </TextField>}
              {deliverySettings.pricingMode === 'standard' && deliverySettings.method !== 'free' && <TextField label={`Default delivery fee (${symbol})`} type="number" inputProps={{ min: 0 }} value={deliverySettings.flatRate} disabled={savingDelivery} onChange={(event) => setDeliveryField('flatRate', event.target.value)} helperText="Applies to every eligible order. Advanced rules do not override standard pricing. A fee of 0 means free delivery." />}
              {deliverySettings.pricingMode === 'standard' && deliverySettings.method === 'free_above_threshold' && <TextField label={`Free delivery from order amount (${symbol})`} type="number" inputProps={{ min: 0 }} value={deliverySettings.freeThreshold} disabled={savingDelivery} onChange={(event) => setDeliveryField('freeThreshold', event.target.value)} />}
              <Typography variant="subtitle1" fontWeight={600}>Delivery coverage</Typography>
              <Typography variant="body2" color="text.secondary">These restrictions apply to every shipping rule and courier. Leave allowed pincodes empty to allow any destination the courier serves. Blocked pincodes always take priority. Rate Zones group pincodes for pricing rules.</Typography>
              <TextField label="Allowed delivery pincodes" value={deliverySettings.serviceablePincodes} disabled={savingDelivery} onChange={(event) => setDeliveryField('serviceablePincodes', event.target.value)} helperText="Separate pincodes with commas." />
              <TextField label="Blocked delivery pincodes" value={deliverySettings.blockedPincodes} disabled={savingDelivery} onChange={(event) => setDeliveryField('blockedPincodes', event.target.value)} helperText="Separate pincodes with commas." />
            </Stack>
            <Stack direction="row" spacing={2}><Button variant="contained" disabled={savingDelivery} onClick={handleSaveDelivery}>{savingDelivery ? 'Saving…' : 'Save pricing and coverage'}</Button><Button onClick={() => setTabIndex(4)}>Check which fee applies</Button></Stack>
          </TabPanel>
          <TabPanel value={tabIndex} index={6} idPrefix="shipping">
            <Typography variant="subtitle1" fontWeight={600}>Measured package types</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add your measured small, medium and large boxes or mailers. Set a mix-group name only for products you have confirmed can share a box. Products with blank or different group names stay separate.
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>Do not enter a package until you have measured its outside dimensions and empty weight. Every shippable product also needs its actual item weight. This does not confirm Shiprocket MPS API booking eligibility.</Alert>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {packageProfiles.length === 0 && <Alert severity="info">No measured package types yet. Checkout will use the existing single-package settings, if enabled.</Alert>}
              {packageProfiles.map((profile) => (
                <Paper key={profile.id} variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography fontWeight={600}>{profile.name}{profile.enabled === false ? ' (inactive)' : ''}</Typography>
                      <Typography variant="body2" color="text.secondary">{profile.lengthCm} × {profile.breadthCm} × {profile.heightCm} cm · {profile.emptyWeightGrams} g empty · up to {profile.maxItems} items / {profile.maxContentsWeightGrams} g contents</Typography>
                      <Typography variant="body2" color="text.secondary">Confirmed product fits: {(profile.fits || []).length} · mix groups: {[...new Set((profile.fits || []).map((fit) => fit.mixGroup).filter(Boolean))].join(', ') || 'none'}</Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button onClick={() => openPackageDialog(profile)}>Edit</Button>
                      <Button color="error" onClick={() => savePackageProfiles(packageProfiles.filter((item) => item.id !== profile.id))}>Remove</Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            <Button variant="contained" startIcon={<AddIcon />} sx={{ mb: 3 }} disabled={savingPackage} onClick={() => openPackageDialog()}>Add measured package</Button>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600}>Single measured package fallback</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Use this only if the same measured box is confirmed to fit every product. It remains for older product setups without package-fit records.</Typography>
              <FormControlLabel control={<Switch checked={defaultPackage.enabled} onChange={(event) => setDefaultPackage((current) => ({ ...current, enabled: event.target.checked }))} />} label="Use one measured package for all products" />
              <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
                {[
                  ['lengthCm', 'Length (cm)'], ['breadthCm', 'Width (cm)'], ['heightCm', 'Height (cm)'],
                  ['emptyWeightGrams', 'Empty package weight (grams)'], ['maxItems', 'Maximum items confirmed to fit'],
                  ['maxContentsWeightGrams', 'Maximum contents weight (grams)'],
                ].map(([key, label]) => (
                  <Grid item xs={12} sm={6} md={4} key={key}>
                    <TextField fullWidth required={defaultPackage.enabled} disabled={!defaultPackage.enabled || savingPackage} label={label} type="number" value={defaultPackage[key]} inputProps={{ min: key === 'emptyWeightGrams' ? 0 : key === 'maxItems' ? 1 : 0.51, step: key === 'maxItems' ? 1 : 'any' }} onChange={(event) => setDefaultPackage((current) => ({ ...current, [key]: event.target.value }))} />
                  </Grid>
                ))}
              </Grid>
              {defaultPackage.enabled && ['lengthCm', 'breadthCm', 'heightCm'].every((key) => Number(defaultPackage[key]) > 0.5) && <Alert severity="info" sx={{ mb: 2 }}>Volumetric equivalent at divisor 5000: {(Number(defaultPackage.lengthCm) * Number(defaultPackage.breadthCm) * Number(defaultPackage.heightCm) / 5000).toFixed(2)} kg. Courier chargeable weight uses the larger of actual packed and volumetric weight.</Alert>}
              <Button variant="outlined" disabled={savingPackage} onClick={handleSavePackage}>{savingPackage ? 'Saving…' : 'Save fallback package'}</Button>
            </Paper>
          </TabPanel>
          <Dialog open={packageDialogOpen} onClose={() => setPackageDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>{packageProfiles.some((profile) => profile.id === packageDraft?.id) ? 'Edit measured package' : 'Add measured package'}</DialogTitle>
            <DialogContent dividers>
              {packageDraft && <Stack spacing={2} sx={{ mt: 1 }}>
                <Alert severity="info">Measure the packed parcel’s outside L × W × H and the empty box/mailer's weight. Product fit limits are merchant-confirmed quantities per parcel, not guesses from product weight.</Alert>
                <TextField label="Package name" required value={packageDraft.name} onChange={(event) => setPackageDraft((current) => ({ ...current, name: event.target.value }))} />
                <Grid container spacing={2}>
                  {[
                    ['lengthCm', 'Length (cm)'], ['breadthCm', 'Width (cm)'], ['heightCm', 'Height (cm)'],
                    ['emptyWeightGrams', 'Empty package weight (g)'], ['maxItems', 'Maximum total items'], ['maxContentsWeightGrams', 'Maximum contents weight (g)'],
                  ].map(([key, label]) => <Grid item xs={12} sm={6} key={key}><TextField fullWidth label={label} required type="number" inputProps={{ min: key === 'emptyWeightGrams' ? 0 : key === 'maxItems' ? 1 : 0.51, step: key === 'maxItems' ? 1 : 'any' }} value={packageDraft[key]} onChange={(event) => setPackageDraft((current) => ({ ...current, [key]: event.target.value }))} /></Grid>)}
                </Grid>
                <FormControlLabel control={<Switch checked={packageDraft.enabled !== false} onChange={(event) => setPackageDraft((current) => ({ ...current, enabled: event.target.checked }))} />} label="Use this package for new checkout plans" />
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 1 }}>Confirmed product fit</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Maximum quantity of each selected product or variant that fits in one parcel.</Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>Products with the same mix-group name may share this package. Leave the group blank to keep a product separate. The planner enforces per-product quantity limits and package-wide item and contents-weight limits.</Alert>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item xs={12} md={4}>
                      <TextField select fullWidth label="Product" value={fitDraft.productId} onChange={(event) => setFitDraft((current) => ({ ...current, productId: event.target.value, variantId: '' }))}>
                        <MenuItem value="">Choose product</MenuItem>
                        {packageProducts.map((product) => <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField select fullWidth label="Variant" value={fitDraft.variantId} disabled={!fitDraft.productId || !(packageProducts.find((product) => product.id === fitDraft.productId)?.variants || []).length} onChange={(event) => setFitDraft((current) => ({ ...current, variantId: event.target.value }))}>
                        <MenuItem value="">All variants / no variants</MenuItem>
                        {(packageProducts.find((product) => product.id === fitDraft.productId)?.variants || []).map((variant) => <MenuItem key={variant.id} value={variant.id}>{variant.optionLabel || variant.name || variant.sku || variant.id}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={8} md={2}><TextField fullWidth type="number" label="Qty / parcel" inputProps={{ min: 1, step: 1 }} value={fitDraft.maxQuantity} onChange={(event) => setFitDraft((current) => ({ ...current, maxQuantity: event.target.value }))} /></Grid>
                    <Grid item xs={8} md={2}><TextField fullWidth label="Mix group (optional)" value={fitDraft.mixGroup} inputProps={{ maxLength: 80 }} onChange={(event) => setFitDraft((current) => ({ ...current, mixGroup: event.target.value }))} helperText="Same group = confirmed compatible" /></Grid>
                    <Grid item xs={4} md={1}><Button aria-label="Add product fit" onClick={addFitToDraft}>Add</Button></Grid>
                  </Grid>
                  <Stack spacing={1} sx={{ mt: 2 }}>
                    {packageDraft.fits.map((fit, index) => {
                      const product = packageProducts.find((entry) => entry.id === fit.productId);
                      const variant = product?.variants?.find((entry) => entry.id === fit.variantId);
                      return <Stack key={`${fit.productId}:${fit.variantId || ''}`} direction="row" justifyContent="space-between" alignItems="center" sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                        <Typography variant="body2">{product?.name || fit.productId}{variant ? ` · ${variant.optionLabel || variant.name || variant.sku || 'Variant'}` : ''} — up to {fit.maxQuantity} per parcel{fit.mixGroup ? ` · mixes with “${fit.mixGroup}”` : ' · packed separately'}</Typography>
                        <Button color="error" aria-label={`Remove fit ${index + 1}`} onClick={() => setPackageDraft((current) => ({ ...current, fits: current.fits.filter((_, rowIndex) => rowIndex !== index) }))}>Remove</Button>
                      </Stack>;
                    })}
                    {!packageDraft.fits.length && <Typography variant="body2" color="text.secondary">No product fit rules added yet.</Typography>}
                  </Stack>
                </Paper>
              </Stack>}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}><Button onClick={() => setPackageDialogOpen(false)}>Cancel</Button><Button variant="contained" disabled={savingPackage} onClick={savePackageDraft}>{savingPackage ? 'Saving…' : 'Save package type'}</Button></DialogActions>
          </Dialog>
          {/* PROVIDERS TAB */}
            <TabPanel value={tabIndex} index={1} idPrefix="shipping" sx={{ pt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Providers handle the actual delivery. Enable/disable providers, test remote carrier credentials, and set default capabilities here.
            </Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Code</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Default</TableCell>
                    <TableCell>COD Support</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Connection Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {providers.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><Chip size="small" label={p.code} /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell>
                        {p.isDefault ? (
                          <Chip 
                            size="small" 
                            color="primary" 
                            label="Default" 
                            icon={<StarIcon sx={{ '&&': { fontSize: '1rem' } }} />} 
                          />
                        ) : (
                          <Button 
                            size="small" 
                            variant="outlined" 
                            disabled={!p.enabled}
                            onClick={() => handleSetDefaultProvider(p)}
                            sx={{ textTransform: 'none', py: 0.25, px: 1, fontSize: '0.75rem' }}
                          >
                            Set Default
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>{p.supportsCod ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={p.enabled} 
                          disabled={p.isDefault}
                          onChange={() => handleToggleProvider(p)} 
                        />
                      </TableCell>
                      <TableCell>
                        {connectionResults[p.id] ? (
                          connectionResults[p.id].success ? (
                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              icon={<CheckCircleIcon sx={{ '&&': { fontSize: '0.9rem' } }} />}
                              label={connectionResults[p.id].locations?.length != null ? `Online (${connectionResults[p.id].locations.length} pickups)` : 'Online'}
                            />
                          ) : (
                            <Chip
                              size="small"
                              color="error"
                              variant="outlined"
                              icon={<ErrorIcon sx={{ '&&': { fontSize: '0.9rem' } }} />}
                              label="Failed"
                              title={connectionResults[p.id].message}
                            />
                          )
                        ) : (
                          <Typography variant="caption" color="text.secondary">Untested</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={testingConnectionId === p.id}
                          onClick={() => handleTestConnection(p)}
                          sx={{ textTransform: 'none', mr: 1, py: 0.25, px: 1, fontSize: '0.75rem' }}
                        >
                          {testingConnectionId === p.id ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <IconButton size="small" onClick={() => handleEditProvider(p)}><EditIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* ZONES TAB */}
            <TabPanel value={tabIndex} index={2} idPrefix="shipping" sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>Rate Zones</Typography>
                <Typography variant="body2" color="text.secondary">Assign these pincode groups to Shipping Rules for regional rates or providers. They do not replace Storewide Delivery Coverage.</Typography>
              </Box>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenZoneDialog()}>
                Add Zone
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Pincodes</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zones.length === 0 ? (
                    <TableRow><TableCell colSpan={4} align="center">No zones configured</TableCell></TableRow>
                  ) : zones.map(z => (
                    <TableRow key={z.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{z.name}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {z.pincodes?.join(', ') || 'Any'}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={z.enabled ? "success" : "default"} label={z.enabled ? "Active" : "Disabled"} />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenZoneDialog(z)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteZone(z.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* RULES TAB */}
            <TabPanel value={tabIndex} index={3} idPrefix="shipping" sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Shipping Rules</Typography>
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenRuleDialog()}>
                Add Rule
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Priority</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Zone</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Rate Type</TableCell>
                    <TableCell>Cost</TableCell>
                    <TableCell>COD Allowed</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center">No rules configured</TableCell></TableRow>
                  ) : [...rules].sort((a,b) => b.priority - a.priority).map(r => {
                    const zone = zones.find(z => z.id === r.zoneId);
                    const provider = providers.find(p => p.id === r.providerId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell><Chip size="small" label={r.priority} /></TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                        <TableCell>{zone ? zone.name : 'All Zones'}</TableCell>
                        <TableCell>{provider ? provider.name : 'Auto/Default'}</TableCell>
                        <TableCell>{r.rateType}</TableCell>
                        <TableCell>
                          {r.rateType === 'free' && <Chip size="small" label="Free" color="success" />}
                          {r.rateType === 'flat' && `${symbol}${r.rateConfig?.amount ?? r.rateConfig?.baseCharge ?? 0}`}
                          {r.rateType === 'free_above_threshold' && `Free ≥${symbol}${r.rateConfig?.threshold ?? 0}`}
                          {r.rateType === 'percent_of_order' && `${r.rateConfig?.percent ?? 0}%`}
                          {(r.rateType === 'per_kg_slab' || r.rateType === 'volumetric') &&
                            `${symbol}${r.rateConfig?.baseCharge ?? 0} + ${symbol}${r.rateConfig?.additionalSlabRate ?? 0}/500g`}
                        </TableCell>
                        <TableCell>{r.codAllowed ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Chip size="small" color={r.enabled ? "success" : "default"} label={r.enabled ? "Active" : "Disabled"} />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" onClick={() => handleOpenRuleDialog(r)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => handleDeleteRule(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* TEST PANEL TAB */}
          <TabPanel value={tabIndex} index={4} idPrefix="shipping">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Test Shipping Engine</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Preview the saved pricing policy and delivery coverage for an order. Use chargeable weight including packaging. This preview does not make a live Shiprocket delivery check.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" mb={2}>Test Parameters</Typography>
                  <Stack spacing={2}>
                    <TextField label="Pincode" size="small" fullWidth value={testParams.pincode} onChange={e => setTestParams({...testParams, pincode: e.target.value})} />
                    <TextField label="Cart Subtotal" type="number" size="small" fullWidth value={testParams.subtotal} onChange={e => setTestParams({...testParams, subtotal: e.target.value})} />
                    <TextField label="Weight (grams)" type="number" size="small" fullWidth value={testParams.weightGrams ?? 500} onChange={e => setTestParams({...testParams, weightGrams: e.target.value})} />
                    <TextField select label="Payment Method" size="small" fullWidth value={testParams.paymentMethod} onChange={e => setTestParams({...testParams, paymentMethod: e.target.value})}>
                      <MenuItem value="prepaid">Prepaid (Online)</MenuItem>
                      <MenuItem value="cod">Cash on Delivery (COD)</MenuItem>
                    </TextField>
                    <Button variant="contained" onClick={handleRunTest} disabled={testingEngine}>
                      {testingEngine ? 'Calculating...' : 'Run Test'}
                    </Button>
                  </Stack>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%', minHeight: 200 }}>
                  <Typography variant="subtitle2" mb={2}>Decision Result</Typography>
                  {testResult ? (
                     <Stack spacing={1}>
                       <Alert severity={testResult.decision?.serviceable ? 'success' : 'warning'}>{testResult.decision?.message}</Alert>
                       <Typography>Customer fee: {testResult.decision?.pricingSource === 'carrier' ? 'Live quote required at checkout' : formatPrice(testResult.decision?.shippingCost || 0)}</Typography>
                       <Typography>{testResult.decision?.pricingReason}</Typography>
                       <Typography>Courier: {testResult.decision?.providerName}</Typography>
                       <Typography>Pickup pincode: {testResult.warehousePincode} · Delivery pincode: {testResult.deliveryPincode}</Typography>
                       <Typography variant="caption">Confirm live courier availability at checkout. This result evaluates saved store settings.</Typography>
                     </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Run a test to see results here.</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* OPERATIONS & FAILURES TAB */}
          <TabPanel value={tabIndex} index={5} idPrefix="shipping" sx={{ pt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <div>
                <Typography variant="subtitle1" fontWeight={600}>{operationStatus === 'failed' ? 'Failed shipping operations' : 'In-progress shipping operations'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Review carrier booking failures or check operations currently queued and processing.
                </Typography>
              </div>
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={() => fetchFailedOperations(1, operationStatus)}
                disabled={failedOpsLoading}
              >
                Refresh
              </Button>
            </Box>

            <Tabs value={operationStatus} onChange={(_, value) => { setOperationStatus(value); fetchFailedOperations(1, value); }} sx={{ mb: 2 }}>
              <Tab value="failed" label="Failed" />
              <Tab value="active" label="In progress" />
            </Tabs>

            {failedOpsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={32} /></Box>
            ) : failedOperations.length === 0 ? (
              <Alert severity={operationStatus === 'failed' ? 'success' : 'info'} sx={{ my: 2 }}>
                {operationStatus === 'failed' ? 'No failed carrier bookings need attention.' : 'No carrier bookings are currently queued or processing.'}
              </Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Order</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Attempts</TableCell>
                      <TableCell>Last Error</TableCell>
                      <TableCell>Updated</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {failedOperations.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {op.shipment?.order?.orderNumber || op.orderId || op.shipmentId || 'N/A'}
                        </TableCell>
                        <TableCell><Chip size="small" label={op.operationType || op.type || 'create'} /></TableCell>
                        <TableCell>{op.provider?.name || op.providerId || 'Provider'}</TableCell>
                        <TableCell><Chip size="small" color={op.status === 'failed' ? 'error' : 'info'} label={op.status} /></TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={op.attempts >= op.maxAttempts ? 'error' : 'warning'}
                            label={`${op.attempts}/${op.maxAttempts}`}
                          />
                        </TableCell>
                        <TableCell sx={{ maxWidth: 320, color: 'error.main', fontSize: '0.8rem' }}>
                          {op.lastError || (op.status === 'failed' ? 'No error detail recorded' : 'No error reported; operation is still in progress.')}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {new Date(op.updatedAt).toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            disabled={retryingOpId === op.id || op.status === 'processing'}
                            onClick={() => handleRetryOperation(op.id)}
                            sx={{ textTransform: 'none', py: 0.25, px: 1, fontSize: '0.75rem' }}
                          >
                            {retryingOpId === op.id ? 'Retrying...' : op.status === 'processing' ? 'Processing' : 'Retry Now'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

        </Box>
      </Paper>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onClose={() => setProviderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Provider: {editingProvider?.name}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField 
              label="Provider Name" 
              fullWidth 
              size="small" 
              value={editingProvider?.name || ''} 
              onChange={(e) => setEditingProvider({...editingProvider, name: e.target.value})} 
            />
            <FormControlLabel 
              control={
                <Switch 
                  checked={editingProvider?.isDefault || false} 
                  disabled={editingProvider?.isDefault}
                  onChange={(e) => setEditingProvider({...editingProvider, isDefault: e.target.checked})} 
                />
              } 
              label={editingProvider?.isDefault ? "Default Provider (Active Default)" : "Set as Default Provider"} 
            />
            <FormControlLabel 
              control={<Switch checked={editingProvider?.supportsCod || false} onChange={(e) => setEditingProvider({...editingProvider, supportsCod: e.target.checked})} />} 
              label="Supports Cash on Delivery" 
            />
                       {editingProvider?.code !== 'manual' && (
              <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  {editingProvider?.name || 'Provider'} API Credentials
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Leave blank to keep existing credentials unchanged.
                </Typography>
                <Stack spacing={2}>
                  <TextField 
                    label="API Email / Key" 
                    fullWidth 
                    size="small" 
                    value={editingProvider?.credEmail || ''} 
                    onChange={(e) => setEditingProvider({...editingProvider, credEmail: e.target.value})} 
                  />
                  <TextField 
                    label="API Password / Secret" 
                    type="password" 
                    fullWidth 
                    size="small" 
                    value={editingProvider?.credPassword || ''} 
                    onChange={(e) => setEditingProvider({...editingProvider, credPassword: e.target.value})} 
                  />
                  <TextField
                    label="Pickup pincode (warehouse origin)"
                    fullWidth
                    size="small"
                    value={editingProvider?.pickupPincode || ''}
                    onChange={(e) => setEditingProvider({...editingProvider, pickupPincode: e.target.value})}
                    helperText="Where the courier collects parcels. This must match the registered Shiprocket pickup location; it does not define customer delivery coverage."
                  />
                  <TextField
                    label="Shiprocket Pickup Location"
                    fullWidth
                    size="small"
                    value={editingProvider?.pickupLocationName || ''}
                    onChange={(e) => setEditingProvider({...editingProvider, pickupLocationName: e.target.value})}
                    helperText="Choose the registered Shiprocket warehouse name whose pincode matches the pickup pincode above."
                  />
                  <TextField
                    label="Webhook Header Key"
                    fullWidth
                    size="small"
                    value={editingProvider?.webhookHeaderName || 'x-api-key'}
                    onChange={(e) => setEditingProvider({...editingProvider, webhookHeaderName: e.target.value})}
                    helperText="Use the Header Key configured in Shiprocket"
                  />
                  <TextField
                    label="Webhook Header Value"
                    type="password"
                    fullWidth
                    size="small"
                    value={editingProvider?.webhookSecret || ''}
                    onChange={(e) => setEditingProvider({...editingProvider, webhookSecret: e.target.value})}
                    helperText={editingProvider?.webhookConfigured ? 'Leave blank to keep the existing value' : 'Required before enabling Shiprocket webhooks'}
                  />
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setProviderDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveProvider}>Save Provider</Button>
        </DialogActions>
      </Dialog>

      {/* Zone Dialog */}
      <Dialog open={zoneDialogOpen} onClose={() => setZoneDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingZone ? 'Edit Zone' : 'Create Zone'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField 
              label="Zone Name" 
              fullWidth 
              size="small" 
              value={zoneFormData.name} 
              onChange={(e) => setZoneFormData({...zoneFormData, name: e.target.value})} 
            />
            <TextField 
              label="Pincodes (comma separated)" 
              fullWidth 
              size="small" 
              multiline
              rows={3}
              placeholder="e.g. 560001, 560002"
              value={zoneFormData.pincodes} 
              onChange={(e) => setZoneFormData({...zoneFormData, pincodes: e.target.value})} 
            />
            <FormControlLabel 
              control={<Switch checked={zoneFormData.enabled} onChange={(e) => setZoneFormData({...zoneFormData, enabled: e.target.checked})} />} 
              label="Enabled" 
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setZoneDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveZone}>Save Zone</Button>
        </DialogActions>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField 
                label="Rule Name" 
                fullWidth 
                size="small" 
                value={ruleFormData.name} 
                onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})} 
              />
              <TextField 
                label="Priority" 
                type="number"
                size="small" 
                sx={{ width: 150 }}
                value={ruleFormData.priority} 
                onChange={(e) => setRuleFormData({...ruleFormData, priority: e.target.value})} 
                helperText="Higher number = higher priority"
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField 
                select
                label="Rate Zone"
                fullWidth 
                size="small" 
                value={ruleFormData.zoneId} 
                onChange={(e) => setRuleFormData({...ruleFormData, zoneId: e.target.value})} 
              >
                <MenuItem value="">All Zones (Everywhere)</MenuItem>
                {zones.map(z => <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>)}
              </TextField>

              <TextField 
                select
                label="Specific Provider (Optional)" 
                fullWidth 
                size="small" 
                value={ruleFormData.providerId} 
                onChange={(e) => setRuleFormData({...ruleFormData, providerId: e.target.value})} 
              >
                <MenuItem value="">Auto / Default Provider</MenuItem>
                {providers.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </TextField>
            </Box>

            <Box>
              <TextField
                select
                label="Rate Type"
                fullWidth
                size="small"
                value={ruleFormData.rateType}
                helperText={['per_kg_slab', 'volumetric'].includes(ruleFormData.rateType)
                  ? 'Calculated for each parcel, then added together.'
                  : 'Charged once per order, even when the order has multiple parcels.'}
                onChange={(e) => setRuleFormData({...ruleFormData, rateType: e.target.value})}
              >
                <MenuItem value="flat">Flat Rate</MenuItem>
                <MenuItem value="free">Free Shipping</MenuItem>
                <MenuItem value="free_above_threshold">Free Above {symbol}X</MenuItem>
                <MenuItem value="per_kg_slab">Per-kg Slab</MenuItem>
                <MenuItem value="volumetric">Volumetric (Per-kg Slab)</MenuItem>
                <MenuItem value="percent_of_order">% of Order Value</MenuItem>
              </TextField>
            </Box>

            {/* FLAT RATE fields */}
            {ruleFormData.rateType === 'flat' && (
              <TextField label={`Shipping Charge (${symbol})`} type="number" fullWidth size="small"
                value={ruleFormData.rc_baseCharge}
                onChange={(e) => setRuleFormData({...ruleFormData, rc_baseCharge: e.target.value})} />
            )}

            {/* FREE ABOVE THRESHOLD fields */}
            {ruleFormData.rateType === 'free_above_threshold' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label={`Free When Cart ≥ (${symbol})`} type="number" fullWidth size="small"
                    value={ruleFormData.rc_threshold}
                    onChange={(e) => setRuleFormData({...ruleFormData, rc_threshold: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={`Charge Below Threshold (${symbol})`} type="number" fullWidth size="small"
                    value={ruleFormData.rc_baseCharge}
                    onChange={(e) => setRuleFormData({...ruleFormData, rc_baseCharge: e.target.value})} />
                </Grid>
              </Grid>
            )}

            {/* PERCENT OF ORDER fields */}
            {ruleFormData.rateType === 'percent_of_order' && (
              <TextField label="Percent of Cart Value (%)" type="number" fullWidth size="small"
                inputProps={{ step: 0.5 }}
                value={ruleFormData.rc_percent}
                onChange={(e) => setRuleFormData({...ruleFormData, rc_percent: e.target.value})} />
            )}

            {/* PER-KG SLAB / VOLUMETRIC fields */}
            {(ruleFormData.rateType === 'per_kg_slab' || ruleFormData.rateType === 'volumetric') && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={2}>Slab Pricing</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <TextField label={`Base Charge (${symbol})`} type="number" fullWidth size="small"
                      value={ruleFormData.rc_baseCharge}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_baseCharge: e.target.value})}
                      helperText="For first slab" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label="First Slab (g)" type="number" fullWidth size="small"
                      value={ruleFormData.rc_firstSlabGrams}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_firstSlabGrams: e.target.value})}
                      helperText="Default 500g" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label="Extra Slab Size (g)" type="number" fullWidth size="small"
                      value={ruleFormData.rc_additionalSlabGrams}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_additionalSlabGrams: e.target.value})}
                      helperText="Default 500g" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label={`Per Slab Rate (${symbol})`} type="number" fullWidth size="small"
                      value={ruleFormData.rc_additionalSlabRate}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_additionalSlabRate: e.target.value})}
                      helperText="Per extra slab" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label={`Min Charge (${symbol})`} type="number" fullWidth size="small"
                      value={ruleFormData.rc_minCharge}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_minCharge: e.target.value})} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label="Fuel Surcharge (%)" type="number" fullWidth size="small"
                      inputProps={{ step: 0.5 }}
                      value={ruleFormData.rc_fuelSurchargePercent}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_fuelSurchargePercent: e.target.value})} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label={`Free Above Subtotal (${symbol})`} type="number" fullWidth size="small"
                      value={ruleFormData.rc_freeAboveSubtotal}
                      placeholder="Leave blank to disable"
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_freeAboveSubtotal: e.target.value})} />
                  </Grid>
                </Grid>

                <Typography variant="subtitle2" fontWeight={600} mt={2} mb={1}>Zone Multipliers</Typography>
                <Grid container spacing={2}>
                  {[['same_city','Same City','rc_zone_same_city'],['same_state','Same State','rc_zone_same_state'],['national','National','rc_zone_national'],['remote','Remote (NE/J&K)','rc_zone_remote']].map(([,label,field]) => (
                    <Grid item xs={6} sm={3} key={field}>
                      <TextField label={label} type="number" fullWidth size="small"
                        inputProps={{ step: 0.1 }}
                        value={ruleFormData[field]}
                        onChange={(e) => setRuleFormData({...ruleFormData, [field]: e.target.value})} />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* COD FEE — shown for all non-free rate types */}
            {ruleFormData.rateType !== 'free' && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={2}>COD Fee</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Added once per order when the customer chooses Cash on Delivery. Free delivery waives the delivery fee; a configured COD fee still applies.</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Fee Type" fullWidth size="small"
                      value={ruleFormData.rc_codFeeType}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_codFeeType: e.target.value})}>
                      <MenuItem value="flat">Flat ({symbol})</MenuItem>
                      <MenuItem value="percent">% of Order</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField label={ruleFormData.rc_codFeeType === 'percent' ? 'Percent (%)' : `Amount (${symbol})`}
                      type="number" fullWidth size="small"
                      value={ruleFormData.rc_codFeeValue}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_codFeeValue: e.target.value})} />
                  </Grid>
                  {ruleFormData.rc_codFeeType === 'percent' && (
                    <Grid item xs={6} sm={4}>
                      <TextField label={`Min COD Fee (${symbol})`} type="number" fullWidth size="small"
                        value={ruleFormData.rc_codFeeMin}
                        onChange={(e) => setRuleFormData({...ruleFormData, rc_codFeeMin: e.target.value})} />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            {/* WEIGHT CONDITIONS */}
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={2}>Weight Conditions (optional)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Compared with the order’s total chargeable weight (the sum across its parcels).</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Chargeable Weight ≥ (g)" type="number" fullWidth size="small"
                    placeholder="Leave blank for no lower bound"
                    value={ruleFormData.cond_weightGte}
                    onChange={(e) => setRuleFormData({...ruleFormData, cond_weightGte: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Chargeable Weight ≤ (g)" type="number" fullWidth size="small"
                    placeholder="Leave blank for no upper bound"
                    value={ruleFormData.cond_weightLte}
                    onChange={(e) => setRuleFormData({...ruleFormData, cond_weightLte: e.target.value})} />
                </Grid>
              </Grid>
            </Box>

            <TextField 
              label="Conditions (JSON format)" 
              multiline 
              rows={4} 
              fullWidth 
              size="small" 
              value={ruleFormData.conditions || ''} 
              onChange={(e) => setRuleFormData({...ruleFormData, conditions: e.target.value})} 
              placeholder='{"subtotalGte": 999}'
              helperText='e.g., {"subtotalGte": 999, "country": "India"} or {} for no conditions'
            />

            <Box sx={{ display: 'flex', gap: 4 }}>
              <FormControlLabel 
                control={<Switch checked={ruleFormData.codAllowed} onChange={(e) => setRuleFormData({...ruleFormData, codAllowed: e.target.checked})} />} 
                label="Allow COD" 
              />
              <FormControlLabel 
                control={<Switch checked={ruleFormData.enabled} onChange={(e) => setRuleFormData({...ruleFormData, enabled: e.target.checked})} />} 
                label="Rule Enabled" 
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRule}>Save Rule</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ShippingPage;
