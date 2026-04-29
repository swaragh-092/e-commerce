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
  const [ruleFormData, setRuleFormData] = useState({ 
    name: '', 
    priority: 100, 
    zoneId: '', 
    providerId: '',
    rateType: 'flat',
    rateConfigAmount: 0,
    codAllowed: true,
    enabled: true
  });

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
      setRuleFormData({
        name: rule.name,
        priority: rule.priority,
        zoneId: rule.zoneId || '',
        providerId: rule.providerId || '',
        rateType: rule.rateType,
        rateConfigAmount: rule.rateConfig?.amount || 0,
        codAllowed: rule.codAllowed,
        enabled: rule.enabled,
        conditions: JSON.stringify(rule.conditions || {}, null, 2)
      });
    } else {
      setEditingRule(null);
      setRuleFormData({ 
        name: '', 
        priority: 100, 
        zoneId: '', 
        providerId: '',
        rateType: 'flat',
        rateConfigAmount: 0,
        codAllowed: true,
        enabled: true,
        conditions: '{}'
      });
    }
    setRuleDialogOpen(true);
  };

  const handleSaveRule = async () => {
    // Validate numeric fields
    const priority = parseInt(ruleFormData.priority, 10);
    const rateAmount = parseFloat(ruleFormData.rateConfigAmount);

    if (isNaN(priority) || !Number.isFinite(priority)) {
      notify('Priority must be a valid number', 'error');
      return;
    }
    if (ruleFormData.rateType !== 'free' && (isNaN(rateAmount) || !Number.isFinite(rateAmount))) {
      notify('Rate amount must be a valid number', 'error');
      return;
    }

    let parsedConditions = {};
    try {
      parsedConditions = JSON.parse(ruleFormData.conditions || '{}');
    } catch (err) {
      notify('Conditions must be valid JSON', 'error');
      return;
    }

    try {
      const payload = {
        name: ruleFormData.name,
        priority: priority,
        zoneId: ruleFormData.zoneId || null,
        providerId: ruleFormData.providerId || null,
        rateType: ruleFormData.rateType,
        rateConfig: { amount: rateAmount || 0 },
        codAllowed: ruleFormData.codAllowed,
        enabled: ruleFormData.enabled,
        conditions: parsedConditions
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
                        <TableCell>{r.rateType === 'flat' ? `₹${r.rateConfig?.amount || 0}` : '-'}</TableCell>
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

            <Box sx={{ display: 'flex', gap: 2 }}>
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
              </TextField>

              {ruleFormData.rateType === 'flat' && (
                <TextField 
                  label="Shipping Cost Amount" 
                  type="number"
                  fullWidth 
                  size="small" 
                  value={ruleFormData.rateConfigAmount} 
                  onChange={(e) => setRuleFormData({...ruleFormData, rateConfigAmount: e.target.value})} 
                />
              )}
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
