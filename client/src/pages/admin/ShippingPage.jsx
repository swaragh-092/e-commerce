import { useEffect, useState } from 'react';
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
import { useNotification } from '../../context/NotificationContext';
import api from '../../services/api';
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
  deleteShippingRule
} from '../../services/adminService';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`shipping-tabpanel-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const ShippingPage = () => {
  const { notify } = useNotification();
  const [tabIndex, setTabIndex] = useState(0);

  // Data states
  const [providers, setProviders] = useState([]);
  const [zones, setZones] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Test Panel State
  const [testParams, setTestParams] = useState({ pincode: '', subtotal: 0, paymentMethod: 'PREPAID' });
  const [testResult, setTestResult] = useState(null);
  const [testingEngine, setTestingEngine] = useState(false);

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
      const [providersRes, zonesRes, rulesRes] = await Promise.all([
        getShippingProviders(),
        getShippingZones(),
        getShippingRules()
      ]);
      setProviders(providersRes.data.data || []);
      setZones(zonesRes.data.data || []);
      setRules(rulesRes.data.data || []);
    } catch (err) {
      notify('Failed to load shipping data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  // --- Providers ---
  const handleToggleProvider = async (id, currentEnabled) => {
    try {
      await updateShippingProvider(id, { enabled: !currentEnabled });
      notify('Provider status updated', 'success');
      fetchData();
    } catch (err) {
      notify('Failed to update provider', 'error');
    }
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    try {
      const payload = { 
        name: editingProvider.name,
        isDefault: editingProvider.isDefault,
        supportsCod: editingProvider.supportsCod
      };

      if (editingProvider.credEmail && editingProvider.credPassword) {
        payload.credentials = {
          email: editingProvider.credEmail,
          password: editingProvider.credPassword
        };
      }

      await updateShippingProvider(editingProvider.id, payload);
      notify('Provider updated successfully', 'success');
      setProviderDialogOpen(false);
      fetchData();
    } catch (err) {
      notify('Failed to update provider', 'error');
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
    setTestingEngine(true);
    setTestResult(null);
    try {
      const payload = {
        deliveryAddress: {
          pincode: testParams.pincode,
          country: 'India'
        },
        items: [
          {
            price: Number(testParams.subtotal),
            quantity: 1,
            requiresShipping: true
          }
        ],
        paymentMethod: testParams.paymentMethod
      };
      const res = await api.post('/shipping/calculate', payload);
      setTestResult(res.data.data);
      notify('Test completed successfully', 'success');
    } catch (err) {
      setTestResult({ error: err.response?.data?.message || err.message });
      notify('Failed to run test', 'error');
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
        <Typography variant="h5" fontWeight={700}>
          Shipping Management
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab label="Shipping Providers" />
          <Tab label="Shipping Zones" />
          <Tab label="Shipping Rules" />
          <Tab label="Test Panel" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* PROVIDERS TAB */}
          <TabPanel value={tabIndex} index={0}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Providers handle the actual delivery. Enable/disable providers and set default capabilities here.
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
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {providers.map(p => (
                    <TableRow key={p.id}>
                      <TableCell><Chip size="small" label={p.code} /></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                      <TableCell>{p.isDefault ? <Chip size="small" color="primary" label="Default" /> : ''}</TableCell>
                      <TableCell>{p.supportsCod ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={p.enabled} 
                          onChange={() => handleToggleProvider(p.id, p.enabled)} 
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEditProvider(p)}><EditIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* ZONES TAB */}
          <TabPanel value={tabIndex} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Delivery Zones</Typography>
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
          <TabPanel value={tabIndex} index={2}>
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
                          {r.rateType === 'flat' && `₹${r.rateConfig?.amount ?? r.rateConfig?.baseCharge ?? 0}`}
                          {r.rateType === 'free_above_threshold' && `Free ≥₹${r.rateConfig?.threshold ?? 0}`}
                          {r.rateType === 'percent_of_order' && `${r.rateConfig?.percent ?? 0}%`}
                          {(r.rateType === 'per_kg_slab' || r.rateType === 'volumetric') &&
                            `₹${r.rateConfig?.baseCharge ?? 0} + ₹${r.rateConfig?.additionalSlabRate ?? 0}/500g`}
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
          <TabPanel value={tabIndex} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>Test Shipping Engine</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Enter order details below to see which rule and provider the shipping engine selects.
            </Alert>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" mb={2}>Test Parameters</Typography>
                  <Stack spacing={2}>
                    <TextField label="Pincode" size="small" fullWidth value={testParams.pincode} onChange={e => setTestParams({...testParams, pincode: e.target.value})} />
                    <TextField label="Cart Subtotal" type="number" size="small" fullWidth value={testParams.subtotal} onChange={e => setTestParams({...testParams, subtotal: e.target.value})} />
                    <TextField select label="Payment Method" size="small" fullWidth value={testParams.paymentMethod} onChange={e => setTestParams({...testParams, paymentMethod: e.target.value})}>
                      <MenuItem value="PREPAID">Prepaid</MenuItem>
                      <MenuItem value="COD">Cash on Delivery</MenuItem>
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
                     <pre style={{ fontSize: '12px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                       {JSON.stringify(testResult, null, 2)}
                     </pre>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Run a test to see results here.</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
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
              control={<Switch checked={editingProvider?.isDefault || false} onChange={(e) => setEditingProvider({...editingProvider, isDefault: e.target.checked})} />} 
              label="Is Default Provider" 
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
                label="Applies to Zone" 
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
                onChange={(e) => setRuleFormData({...ruleFormData, rateType: e.target.value})}
              >
                <MenuItem value="flat">Flat Rate</MenuItem>
                <MenuItem value="free">Free Shipping</MenuItem>
                <MenuItem value="free_above_threshold">Free Above ₹X</MenuItem>
                <MenuItem value="per_kg_slab">Per-kg Slab</MenuItem>
                <MenuItem value="volumetric">Volumetric (Per-kg Slab)</MenuItem>
                <MenuItem value="percent_of_order">% of Order Value</MenuItem>
              </TextField>
            </Box>

            {/* FLAT RATE fields */}
            {ruleFormData.rateType === 'flat' && (
              <TextField label="Shipping Charge (₹)" type="number" fullWidth size="small"
                value={ruleFormData.rc_baseCharge}
                onChange={(e) => setRuleFormData({...ruleFormData, rc_baseCharge: e.target.value})} />
            )}

            {/* FREE ABOVE THRESHOLD fields */}
            {ruleFormData.rateType === 'free_above_threshold' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label="Free When Cart ≥ (₹)" type="number" fullWidth size="small"
                    value={ruleFormData.rc_threshold}
                    onChange={(e) => setRuleFormData({...ruleFormData, rc_threshold: e.target.value})} />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Charge Below Threshold (₹)" type="number" fullWidth size="small"
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
                    <TextField label="Base Charge (₹)" type="number" fullWidth size="small"
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
                    <TextField label="Per Slab Rate (₹)" type="number" fullWidth size="small"
                      value={ruleFormData.rc_additionalSlabRate}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_additionalSlabRate: e.target.value})}
                      helperText="Per extra slab" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField label="Min Charge (₹)" type="number" fullWidth size="small"
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
                    <TextField label="Free Above Subtotal (₹)" type="number" fullWidth size="small"
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
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField select label="Fee Type" fullWidth size="small"
                      value={ruleFormData.rc_codFeeType}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_codFeeType: e.target.value})}>
                      <MenuItem value="flat">Flat (₹)</MenuItem>
                      <MenuItem value="percent">% of Order</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={4}>
                    <TextField label={ruleFormData.rc_codFeeType === 'percent' ? 'Percent (%)' : 'Amount (₹)'}
                      type="number" fullWidth size="small"
                      value={ruleFormData.rc_codFeeValue}
                      onChange={(e) => setRuleFormData({...ruleFormData, rc_codFeeValue: e.target.value})} />
                  </Grid>
                  {ruleFormData.rc_codFeeType === 'percent' && (
                    <Grid item xs={6} sm={4}>
                      <TextField label="Min COD Fee (₹)" type="number" fullWidth size="small"
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
