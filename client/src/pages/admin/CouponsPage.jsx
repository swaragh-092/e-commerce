import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useCurrency } from '../../hooks/useSettings';
import { getProducts } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
import brandService from '../../services/brandService';

const empty = {
  name: '',
  description: '',
  code: '',
  campaignStatus: 'active',
  applicationMode: 'manual',
  stackingRules: {
    allowOrderDiscounts: false,
    allowShippingDiscounts: true,
    allowMultipleCoupons: false,
  },
  type: 'percentage',
  value: '',
  minOrderAmount: '',
  maxDiscount: '',
  usageLimit: '',
  perUserLimit: 1,
  startDate: '',
  endDate: '',
  isActive: true,
  visibility: 'private',
  applicableTo: 'all',
  applicableIds: [],
  excludedProductIds: [],
  excludedCategoryIds: [],
  excludedBrandIds: [],
  excludeSaleItems: false,
  customerEligibility: 'all',
  isExclusive: false,
  priority: 0,
};

const flattenCategoryTree = (nodes = [], prefix = '') =>
  nodes.flatMap((node) => {
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    return [
      { id: node.id, name: label },
      ...flattenCategoryTree(node.children || [], label),
    ];
  });

const formatLocalDateTime = (value) => (value ? new Date(value).toISOString().slice(0, 16) : '');

const CouponsPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const notify = useNotification();
  const { formatPrice } = useCurrency();

  const productOptions = useMemo(
    () => products.map((product) => ({ id: product.id, name: `${product.name}${product.sku ? ` (${product.sku})` : ''}` })),
    [products]
  );
  const brandOptions = useMemo(() => brands.map((brand) => ({ id: brand.id, name: brand.name })), [brands]);

  const optionMap = useMemo(() => {
    const map = new Map();
    [...productOptions, ...categories, ...brandOptions].forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [productOptions, categories, brandOptions]);

  const validate = (nextForm) => {
    const errs = {};
    if (!nextForm.name?.trim()) errs.name = 'Name is required';
    if (!nextForm.code?.trim()) errs.code = 'Code is required';
    if (nextForm.type !== 'free_shipping') {
      if (nextForm.value === '' || nextForm.value === null || nextForm.value === undefined) {
        errs.value = 'Value is required';
      } else if (Number(nextForm.value) <= 0) {
        errs.value = 'Must be a positive number';
      } else if (nextForm.type === 'percentage' && Number(nextForm.value) > 100) {
        errs.value = 'Percentage cannot exceed 100';
      }
    }
    if (nextForm.minOrderAmount !== '' && Number(nextForm.minOrderAmount) < 0) {
      errs.minOrderAmount = 'Must be 0 or more';
    }
    if (nextForm.type === 'percentage' && nextForm.maxDiscount !== '' && Number(nextForm.maxDiscount) < 0) {
      errs.maxDiscount = 'Must be 0 or more';
    }
    if (nextForm.usageLimit !== '' && Number(nextForm.usageLimit) < 1) {
      errs.usageLimit = 'Must be at least 1';
    }
    if (nextForm.perUserLimit !== '' && Number(nextForm.perUserLimit) < 1) {
      errs.perUserLimit = 'Must be at least 1';
    }
    if (!nextForm.startDate) errs.startDate = 'Start date is required';
    if (!nextForm.endDate) errs.endDate = 'End date is required';
    if (nextForm.startDate && nextForm.endDate && new Date(nextForm.endDate) <= new Date(nextForm.startDate)) {
      errs.endDate = 'End date must be after start date';
    }
    if (nextForm.applicableTo !== 'all' && (!Array.isArray(nextForm.applicableIds) || nextForm.applicableIds.length === 0)) {
      errs.applicableIds = 'Select at least one target';
    }
    return errs;
  };

  const fetchCoupons = () => {
    setLoading(true);
    getCoupons({ page: paginationModel.page + 1, limit: paginationModel.pageSize })
      .then((res) => {
        setRows(res.data.data?.rows || res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      })
      .catch(() => notify('Failed to load coupons.', 'error'))
      .finally(() => setLoading(false));
  };

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const [productResponse, categoryResponse, brandResponse] = await Promise.all([
        getProducts({ page: 1, limit: 100 }),
        getCategoryTree(),
        brandService.getBrands({ page: 1, limit: 100 }),
      ]);

      setProducts(productResponse?.data || []);
      setCategories(flattenCategoryTree(categoryResponse?.data?.categories || []));
      setBrands(brandResponse?.data?.data || []);
    } catch (error) {
      notify('Failed to load coupon targeting options.', 'error');
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [paginationModel]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setForm(empty);
    setFormErrors({});
  };

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setFormErrors({});
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      ...empty,
      ...row,
      value: row.type === 'free_shipping' ? '' : row.value,
      minOrderAmount: row.minOrderAmount ?? '',
      maxDiscount: row.maxDiscount ?? '',
      usageLimit: row.usageLimit ?? '',
      perUserLimit: row.perUserLimit ?? 1,
      startDate: formatLocalDateTime(row.startDate),
      endDate: formatLocalDateTime(row.endDate),
      applicableIds: row.applicableIds || [],
      excludedProductIds: row.excludedProductIds || [],
      excludedCategoryIds: row.excludedCategoryIds || [],
      excludedBrandIds: row.excludedBrandIds || [],
      campaignStatus: row.campaignStatus || 'active',
      applicationMode: row.applicationMode || 'manual',
      stackingRules: {
        allowOrderDiscounts: Boolean(row.stackingRules?.allowOrderDiscounts),
        allowShippingDiscounts: row.stackingRules?.allowShippingDiscounts !== false,
        allowMultipleCoupons: Boolean(row.stackingRules?.allowMultipleCoupons),
      },
    });
    setFormErrors({});
    setOpen(true);
  };

  const duplicateCoupon = (row) => {
    setEditing(null);
    setForm({
      ...empty,
      ...row,
      name: `${row.name} Copy`,
      code: `${row.code}_COPY`,
      startDate: formatLocalDateTime(row.startDate),
      endDate: formatLocalDateTime(row.endDate),
      applicableIds: row.applicableIds || [],
      excludedProductIds: row.excludedProductIds || [],
      excludedCategoryIds: row.excludedCategoryIds || [],
      excludedBrandIds: row.excludedBrandIds || [],
      value: row.type === 'free_shipping' ? '' : row.value,
      campaignStatus: row.campaignStatus || 'active',
      applicationMode: row.applicationMode || 'manual',
      stackingRules: {
        allowOrderDiscounts: Boolean(row.stackingRules?.allowOrderDiscounts),
        allowShippingDiscounts: row.stackingRules?.allowShippingDiscounts !== false,
        allowMultipleCoupons: Boolean(row.stackingRules?.allowMultipleCoupons),
      },
    });
    setFormErrors({});
    setOpen(true);
  };

  const set = (key, value) => {
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const cleanForm = (nextForm) => ({
    name: nextForm.name.trim(),
    description: nextForm.description?.trim() || null,
    code: nextForm.code.trim().toUpperCase(),
    type: nextForm.type,
    value: nextForm.type === 'free_shipping' ? 0 : Number(nextForm.value),
    minOrderAmount: nextForm.minOrderAmount === '' ? 0 : Number(nextForm.minOrderAmount),
    maxDiscount: nextForm.type === 'percentage' && nextForm.maxDiscount !== '' ? Number(nextForm.maxDiscount) : null,
    usageLimit: nextForm.usageLimit === '' ? null : Number(nextForm.usageLimit),
    perUserLimit: Number(nextForm.perUserLimit || 1),
    startDate: nextForm.startDate,
    endDate: nextForm.endDate,
    isActive: Boolean(nextForm.isActive) && nextForm.campaignStatus === 'active',
    campaignStatus: nextForm.campaignStatus,
    applicationMode: nextForm.applicationMode,
    stackingRules: nextForm.stackingRules,
    visibility: nextForm.visibility,
    applicableTo: nextForm.applicableTo,
    applicableIds: nextForm.applicableTo === 'all' ? [] : nextForm.applicableIds,
    excludedProductIds: nextForm.excludedProductIds,
    excludedCategoryIds: nextForm.excludedCategoryIds,
    excludedBrandIds: nextForm.excludedBrandIds,
    excludeSaleItems: Boolean(nextForm.excludeSaleItems),
    customerEligibility: nextForm.customerEligibility,
    isExclusive: Boolean(nextForm.isExclusive),
    priority: Number(nextForm.priority || 0),
  });

  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const payload = cleanForm(form);
      if (editing) await updateCoupon(editing.id, payload);
      else await createCoupon(payload);
      closeDialog();
      fetchCoupons();
      notify(editing ? 'Coupon updated.' : 'Coupon created.', 'success');
    } catch (error) {
      const err = error.response?.data;
      const apiErr = err?.error || err;
      const msg = apiErr?.message || 'Failed to save coupon.';
      const details = apiErr?.details?.map((detail) => detail.message).join('; ');
      notify(details ? `${msg}: ${details}` : msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this coupon?')) return;
    deleteCoupon(id)
      .then(() => {
        fetchCoupons();
        notify('Coupon deleted.', 'success');
      })
      .catch(() => notify('Failed to delete coupon.', 'error'));
  };

  const getOptionsForScope = () => {
    if (form.applicableTo === 'product') return productOptions;
    if (form.applicableTo === 'category') return categories;
    if (form.applicableTo === 'brand') return brandOptions;
    return [];
  };

  const offerPreview = useMemo(() => {
    if (!form.name && !form.code) return null;

    const headline = form.type === 'free_shipping'
      ? 'Free shipping'
      : form.type === 'percentage'
        ? `${form.value || 0}% off`
        : `${formatPrice(Number(form.value) || 0)} off`;

    const qualifiers = [];
    if (form.minOrderAmount) qualifiers.push(`min order ${formatPrice(Number(form.minOrderAmount) || 0)}`);
    if (form.applicableTo !== 'all') qualifiers.push(`selected ${form.applicableTo}s only`);
    if (form.customerEligibility === 'first_order') qualifiers.push('first order only');
    if (form.excludeSaleItems) qualifiers.push('sale items excluded');
    if (form.visibility === 'public') qualifiers.push('shown to customers');
    if (form.isExclusive) qualifiers.push('exclusive offer');
    if (form.applicationMode === 'auto') qualifiers.push('auto apply');
    if (form.applicationMode === 'suggest') qualifiers.push('suggest best offer');

    return { headline, qualifiers };
  }, [form, formatPrice]);

  const renderSelection = (label, field, options) => (
    <Autocomplete
      multiple
      options={options}
      loading={loadingOptions}
      value={(form[field] || []).map((id) => optionMap.get(id)).filter(Boolean)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_, value) => set(field, value.map((item) => item.id))}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => (
          <Chip {...getTagProps({ index })} key={option.id} label={option.name} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={label}
          error={field === 'applicableIds' && !!formErrors.applicableIds}
          helperText={field === 'applicableIds' ? formErrors.applicableIds : undefined}
        />
      )}
    />
  );

  const columns = [
    {
      field: 'name',
      headerName: 'Campaign',
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Box sx={{ py: 1 }}>
          <Typography variant="body2" fontWeight={700}>{row.name}</Typography>
          <Typography variant="caption" color="text.secondary">{row.code}</Typography>
        </Box>
      ),
    },
    {
      field: 'offer',
      headerName: 'Offer',
      minWidth: 170,
      flex: 1,
      renderCell: ({ row }) => {
        if (row.type === 'free_shipping') return 'Free shipping';
        return row.type === 'percentage' ? `${row.value}% off` : formatPrice(row.value);
      },
    },
    {
      field: 'scope',
      headerName: 'Scope',
      minWidth: 170,
      flex: 1,
      renderCell: ({ row }) => (
        <Stack spacing={0.25} sx={{ py: 1 }}>
          <Typography variant="caption">{row.applicableTo === 'all' ? 'Entire order' : `Selected ${row.applicableTo}s`}</Typography>
          <Typography variant="caption" color="text.secondary">{row.customerEligibility.replace('_', ' ')}</Typography>
        </Stack>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 130,
      renderCell: ({ value, row }) => (
        <Chip
          label={String(value || '').replaceAll('_', ' ')}
          size="small"
          color={value === 'active' ? 'success' : row.isActive ? 'warning' : 'default'}
          variant={value === 'active' ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'visibility',
      headerName: 'Visibility',
      minWidth: 120,
      renderCell: ({ value }) => <Chip label={value} size="small" variant="outlined" />,
    },
    {
      field: 'applicationMode',
      headerName: 'Apply Mode',
      minWidth: 130,
      renderCell: ({ value }) => <Chip label={value} size="small" variant="outlined" />,
    },
    {
      field: 'usage',
      headerName: 'Usage',
      minWidth: 140,
      renderCell: ({ row }) => {
        const pct = row.usageLimit ? (row.usedCount / row.usageLimit) * 100 : -1;
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{row.usedCount}/{row.usageLimit ?? '∞'}</Typography>
            {pct >= 0 && <LinearProgress variant="determinate" value={Math.min(pct, 100)} sx={{ mt: 0.5 }} />}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: '',
      width: 120,
      sortable: false,
      renderCell: ({ row }) => (
        <>
          <Tooltip title="Duplicate">
            <IconButton size="small" onClick={() => duplicateCoupon(row)}>
              <FileCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => openEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Coupons & Promotions</Typography>
          <Typography variant="body2" color="text.secondary">Build targeted offers with schedule, visibility, exclusions, and eligibility rules.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New Promotion</Button>
      </Box>

      <Box sx={{ height: 620, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          rowCount={total}
          loading={loading}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          disableRowSelectionOnClick
        />
      </Box>

      <Dialog open={open} onClose={closeDialog} maxWidth="lg" fullWidth>
        <DialogTitle>{editing ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.25fr 0.75fr' }, gap: 3 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>General</Typography>
                <Stack spacing={2}>
                  <TextField size="small" label="Internal name *" value={form.name} error={!!formErrors.name} helperText={formErrors.name} onChange={(e) => set('name', e.target.value)} />
                  <TextField size="small" label="Customer-facing code *" value={form.code} error={!!formErrors.code} helperText={formErrors.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
                  <TextField size="small" label="Description" multiline minRows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Lifecycle</InputLabel>
                      <Select label="Lifecycle" value={form.campaignStatus} onChange={(e) => set('campaignStatus', e.target.value)}>
                        <MenuItem value="draft">Draft</MenuItem>
                        <MenuItem value="active">Active / scheduled</MenuItem>
                        <MenuItem value="paused">Paused</MenuItem>
                        <MenuItem value="archived">Archived</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                      <InputLabel>Application mode</InputLabel>
                      <Select label="Application mode" value={form.applicationMode} onChange={(e) => set('applicationMode', e.target.value)}>
                        <MenuItem value="manual">Manual code entry</MenuItem>
                        <MenuItem value="suggest">Suggest when eligible</MenuItem>
                        <MenuItem value="auto">Auto apply best eligible</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>Discount</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={form.type} onChange={(e) => set('type', e.target.value)}>
                      <MenuItem value="percentage">Percentage discount</MenuItem>
                      <MenuItem value="fixed_amount">Fixed amount discount</MenuItem>
                      <MenuItem value="free_shipping">Free shipping</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label={form.type === 'percentage' ? 'Value (%) *' : 'Value *'}
                    type="number"
                    value={form.type === 'free_shipping' ? '' : form.value}
                    error={!!formErrors.value}
                    helperText={form.type === 'free_shipping' ? 'No amount needed for free shipping.' : formErrors.value}
                    disabled={form.type === 'free_shipping'}
                    inputProps={{ min: 0, max: form.type === 'percentage' ? 100 : undefined, step: 'any' }}
                    onChange={(e) => set('value', e.target.value)}
                  />
                  <TextField size="small" label="Minimum order amount" type="number" value={form.minOrderAmount} error={!!formErrors.minOrderAmount} helperText={formErrors.minOrderAmount} inputProps={{ min: 0, step: 'any' }} onChange={(e) => set('minOrderAmount', e.target.value)} />
                  <TextField size="small" label="Maximum discount cap" type="number" value={form.type === 'percentage' ? form.maxDiscount : ''} error={!!formErrors.maxDiscount} helperText={form.type === 'percentage' ? formErrors.maxDiscount : 'Only used for percentage discounts.'} disabled={form.type !== 'percentage'} inputProps={{ min: 0, step: 'any' }} onChange={(e) => set('maxDiscount', e.target.value)} />
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>Applies To</Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Scope</InputLabel>
                    <Select label="Scope" value={form.applicableTo} onChange={(e) => set('applicableTo', e.target.value)}>
                      <MenuItem value="all">Entire order</MenuItem>
                      <MenuItem value="product">Selected products</MenuItem>
                      <MenuItem value="category">Selected categories</MenuItem>
                      <MenuItem value="brand">Selected brands</MenuItem>
                    </Select>
                  </FormControl>
                  {form.applicableTo !== 'all' && renderSelection('Included targets', 'applicableIds', getOptionsForScope())}
                  {renderSelection('Excluded products', 'excludedProductIds', productOptions)}
                  {renderSelection('Excluded categories', 'excludedCategoryIds', categories)}
                  {renderSelection('Excluded brands', 'excludedBrandIds', brandOptions)}
                  <FormControlLabel control={<Switch checked={Boolean(form.excludeSaleItems)} onChange={(e) => set('excludeSaleItems', e.target.checked)} />} label="Exclude products already on sale" />
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>Eligibility & Limits</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Customer eligibility</InputLabel>
                    <Select label="Customer eligibility" value={form.customerEligibility} onChange={(e) => set('customerEligibility', e.target.value)}>
                      <MenuItem value="all">All customers</MenuItem>
                      <MenuItem value="authenticated">Signed-in customers</MenuItem>
                      <MenuItem value="first_order">First order only</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField size="small" label="Priority" type="number" helperText="Higher priority appears first in admin/public lists." value={form.priority} inputProps={{ min: 0, step: 1 }} onChange={(e) => set('priority', e.target.value)} />
                  <TextField size="small" label="Total usage limit" type="number" value={form.usageLimit} error={!!formErrors.usageLimit} helperText={formErrors.usageLimit || 'Leave blank for unlimited use.'} inputProps={{ min: 1, step: 1 }} onChange={(e) => set('usageLimit', e.target.value)} />
                  <TextField size="small" label="Per-customer limit" type="number" value={form.perUserLimit} error={!!formErrors.perUserLimit} helperText={formErrors.perUserLimit} inputProps={{ min: 1, step: 1 }} onChange={(e) => set('perUserLimit', e.target.value)} />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Visibility</InputLabel>
                    <Select label="Visibility" value={form.visibility} onChange={(e) => set('visibility', e.target.value)}>
                      <MenuItem value="private">Hidden code</MenuItem>
                      <MenuItem value="public">Show in checkout offers</MenuItem>
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControlLabel control={<Switch checked={Boolean(form.isExclusive)} onChange={(e) => set('isExclusive', e.target.checked)} />} label="Exclusive offer" />
                    <FormControlLabel control={<Switch checked={Boolean(form.isActive)} onChange={(e) => set('isActive', e.target.checked)} />} label="Enabled" />
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <FormControlLabel control={<Switch checked={Boolean(form.stackingRules.allowOrderDiscounts)} onChange={(e) => set('stackingRules', { ...form.stackingRules, allowOrderDiscounts: e.target.checked })} />} label="Can combine with order discounts" />
                    <FormControlLabel control={<Switch checked={Boolean(form.stackingRules.allowShippingDiscounts)} onChange={(e) => set('stackingRules', { ...form.stackingRules, allowShippingDiscounts: e.target.checked })} />} label="Can combine with shipping discounts" />
                    <FormControlLabel control={<Switch checked={Boolean(form.stackingRules.allowMultipleCoupons)} onChange={(e) => set('stackingRules', { ...form.stackingRules, allowMultipleCoupons: e.target.checked })} />} label="Can combine with another coupon" />
                  </Box>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>Schedule</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField size="small" label="Start date *" type="datetime-local" value={form.startDate} InputLabelProps={{ shrink: true }} error={!!formErrors.startDate} helperText={formErrors.startDate} onChange={(e) => set('startDate', e.target.value)} />
                  <TextField size="small" label="End date *" type="datetime-local" value={form.endDate} InputLabelProps={{ shrink: true }} error={!!formErrors.endDate} helperText={formErrors.endDate} onChange={(e) => set('endDate', e.target.value)} />
                </Box>
              </Box>
            </Stack>

            <Stack spacing={2}>
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle1" fontWeight={700} mb={1}>Promotion Summary</Typography>
                {offerPreview ? (
                  <>
                    <Typography variant="h6" fontWeight={700}>{offerPreview.headline}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{form.name || 'Untitled promotion'}</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {(offerPreview.qualifiers.length ? offerPreview.qualifiers : ['No extra restrictions']).map((qualifier) => (
                        <Chip key={qualifier} label={qualifier} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">Add basic details to preview this promotion.</Typography>
                )}
              </Box>

              <Alert severity="info">
                Public promotions appear in the checkout coupon step. Private promotions still work, but only when customers know the code.
              </Alert>

              {form.isExclusive && <Alert severity="warning">Exclusive is stored now so future stacking rules can respect it.</Alert>}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Promotion'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CouponsPage;
