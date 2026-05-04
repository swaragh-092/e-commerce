import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    Box, Typography, Tabs, Tab, Paper, Container, TextField, Button, Alert,
    List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, Divider, CircularProgress,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, InputAdornment
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import AddIcon from '@mui/icons-material/Add';
import { AuthContext } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import AvatarUploader from '../../components/common/AvatarUploader';
import PageSEO from '../../components/common/PageSEO';
import { Link } from 'react-router-dom';
import { useCurrency } from '../../hooks/useSettings';
import CenteredLoader from '../../components/common/CenteredLoader';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useNotification } from '../../context/NotificationContext';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { getPasswordChecks } from '../../utils/authValidation';

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const AccountPage = () => {
    const { user, updateProfile } = useContext(AuthContext);
    const { confirm } = useNotification();
    const [tab, setTab] = useState(0);

    if (!user) return null;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <PageSEO title="My Account" type="noindex" />
            <Typography variant="h4" gutterBottom>My Account</Typography>
            <Paper sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                        <Tab label="Profile" />
                        <Tab label="Addresses" />
                        <Tab label="Password" />
                    </Tabs>
                </Box>
                <TabPanel value={tab} index={0}>
                    <ProfileTab user={user} updateProfile={updateProfile} />
                </TabPanel>
                <TabPanel value={tab} index={1}>
                    <AddressesTab />
                </TabPanel>
                <TabPanel value={tab} index={2}>
                    <PasswordTab />
                </TabPanel>
            </Paper>
        </Container>
    );
};

/* ─── Profile Tab ─────────────────────────────────────────────────────── */
const ProfileTab = ({ user, updateProfile }) => {
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phone: user?.profile?.phone || '',
    });
    const [status, setStatus] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateProfile(formData);
            setStatus({ type: 'success', message: 'Profile updated successfully' });
        } catch (error) {
            setStatus({ type: 'error', message: getApiErrorMessage(error, 'Update failed') });
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400 }}>
            <AvatarUploader />
            {status && <Alert severity={status.type} sx={{ mb: 2 }}>{status.message}</Alert>}
            <TextField fullWidth label="First Name" name="firstName" value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} margin="normal" required />
            <TextField fullWidth label="Last Name" name="lastName" value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} margin="normal" required />
            <TextField fullWidth label="Phone" name="phone" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} margin="normal" />
            <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>Save Changes</Button>
        </Box>
    );
};

/* ─── Addresses Tab ───────────────────────────────────────────────────── */
const emptyAddr = { label: '', fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: '' };

const AddressesTab = () => {
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyAddr);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});

    const fetchAddresses = useCallback(async () => {
        setLoading(true);
        try {
            const data = await userService.getAddresses();
            setAddresses(Array.isArray(data) ? data : data?.rows || []);
        } catch (err) {
            setAlert({ type: 'error', message: 'Failed to load addresses.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

    const openCreate = () => { setEditing(null); setForm(emptyAddr); setValidationErrors({}); setDialogOpen(true); };
    const openEdit = (addr) => { setEditing(addr); setForm({ ...addr }); setValidationErrors({}); setDialogOpen(true); };

    const handleSave = async () => {
        setSaving(true);
        setValidationErrors({});
        try {
            if (editing) await userService.updateAddress(editing.id, form);
            else await userService.createAddress(form);
            setDialogOpen(false);
            fetchAddresses();
        } catch (err) {
            const errData = err?.response?.data?.error;
            if (errData?.code === 'VALIDATION_ERROR' && errData?.details) {
                const errors = {};
                errData.details.forEach(detail => { errors[detail.field] = detail.message; });
                setValidationErrors(errors);
            } else {
                setAlert({ type: 'error', message: getApiErrorMessage(err, 'Failed to save address.') });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await confirm(
            'Delete Address',
            'Are you sure you want to delete this address?',
            'error'
        );
        if (!confirmed) return;
        try {
            await userService.deleteAddress(id);
            setAddresses((prev) => prev.filter((a) => a.id !== id));
        } catch (err) {
            setAlert({ type: 'error', message: getApiErrorMessage(err, 'Failed to delete address.') });
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await userService.setDefaultAddress(id);
            setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
        } catch (err) {
            setAlert({ type: 'error', message: getApiErrorMessage(err, 'Failed to set default address.') });
        }
    };

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    if (loading) return <CenteredLoader message="Loading your addresses..." minHeight="220px" />;

    return (
        <Box>
            {alert && <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>{alert.message}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Saved Addresses</Typography>
                <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={openCreate}>Add Address</Button>
            </Box>

            {addresses.length === 0 ? (
                <Typography color="text.secondary">No addresses saved yet.</Typography>
            ) : (
                <List disablePadding>
                    {addresses.map((addr, i) => (
                        <React.Fragment key={addr.id}>
                            {i > 0 && <Divider />}
                            <ListItem alignItems="flex-start" sx={{ pr: 12 }}>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="body1" fontWeight={600}>{addr.label || 'Address'}</Typography>
                                            {addr.isDefault && <Chip label="Default" size="small" color="primary" />}
                                        </Box>
                                    }
                                    secondary={
                                        <>
                                            <Typography variant="body2">{addr.fullName}</Typography>
                                            <Typography variant="body2">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</Typography>
                                            <Typography variant="body2">{addr.city}, {addr.state} {addr.postalCode}, {addr.country}</Typography>
                                            {addr.phone && <Typography variant="body2">{addr.phone}</Typography>}
                                        </>
                                    }
                                />
                                <ListItemSecondaryAction>
                                    <Tooltip title="Edit">
                                        <IconButton size="small" onClick={() => openEdit(addr)}><EditIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                    {!addr.isDefault ? (
                                        <Tooltip title="Set as Default">
                                            <IconButton size="small" onClick={() => handleSetDefault(addr.id)}><StarBorderIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Default Address">
                                            <span>
                                                <IconButton size="small" disabled><StarIcon fontSize="small" color="primary" /></IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                    <Tooltip title="Delete">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(addr.id)}><DeleteIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                </ListItemSecondaryAction>
                            </ListItem>
                        </React.Fragment>
                    ))}
                </List>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editing ? 'Edit Address' : 'Add Address'}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <TextField size="small" label="Label (e.g. Home, Work)" value={form.label} onChange={(e) => set('label', e.target.value)} error={!!validationErrors.label} helperText={validationErrors.label} />
                    <TextField size="small" label="Full Name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required error={!!validationErrors.fullName} helperText={validationErrors.fullName} />
                    <TextField size="small" label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={!!validationErrors.phone} helperText={validationErrors.phone} />
                    <TextField size="small" label="Address Line 1" value={form.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} required error={!!validationErrors.addressLine1} helperText={validationErrors.addressLine1} />
                    <TextField size="small" label="Address Line 2 (optional)" value={form.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} error={!!validationErrors.addressLine2} helperText={validationErrors.addressLine2} />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField size="small" label="City" value={form.city} onChange={(e) => set('city', e.target.value)} required fullWidth error={!!validationErrors.city} helperText={validationErrors.city} />
                        <TextField size="small" label="State/Province" value={form.state} onChange={(e) => set('state', e.target.value)} fullWidth error={!!validationErrors.state} helperText={validationErrors.state} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField size="small" label="Postal Code" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} required fullWidth error={!!validationErrors.postalCode} helperText={validationErrors.postalCode} />
                        <TextField size="small" label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} required fullWidth error={!!validationErrors.country} helperText={validationErrors.country} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

/* ─── Password Tab ────────────────────────────────────────────────────── */
const PasswordTab = () => {
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: ''});
    const [status, setStatus] = useState(null);
    const [validationErrors, setValidationErrors] = useState({});
    const [showPassword, setShowPassword] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false
    });

    const PasswordChecklist = ({ password }) => {
        const checks = getPasswordChecks(password);

        const missingRules = [
            !checks.length && 'At least 8 characters',
            !checks.uppercase && '1 uppercase letter',
            !checks.lowercase && '1 lowercase letter',
            !checks.number && '1 number',
            !checks.symbol && '1 special character',
        ].filter(Boolean);

        return (
            <Box sx={{ mt: 1 }}>
                {missingRules.map((rule, index) => (
                    <Typography
                        key={index}
                        variant="caption"
                        sx={{ display: 'block', color: 'error.main' }}
                    >
                        {rule}
                    </Typography>
                ))}
            </Box>
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationErrors({});
        setStatus(null);
        try {
            await userService.changePassword(passwords);
            setStatus({ type: 'success', message: 'Password changed successfully' });
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            const errData = error?.response?.data?.error;
            if (errData?.code === 'VALIDATION_ERROR' && errData?.details) {
                const errors = {};
                errData.details.forEach(d => { errors[d.field] = d.message; });
                setValidationErrors(errors);
            } else {
                setStatus({ type: 'error', message: getApiErrorMessage(error, 'Password change failed') });
            }
        }
    };

    const handleToggle = (field) => {
        setShowPassword(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const renderPasswordField = (name, label) => {
        const isNewPassword = name === 'newPassword';

        return (
            <TextField
                fullWidth
                type={showPassword[name] ? 'text' : 'password'}
                label={label}
                name={name}
                value={passwords[name]}
                onChange={(e) => setPasswords({ ...passwords, [name]: e.target.value })}
                margin="normal"
                error={!!validationErrors[name]}
                helperText={
                    isNewPassword ? (
                        <>
                            <PasswordChecklist password={passwords.newPassword} />
                            {validationErrors[name] && (
                                <Typography variant="caption" color="error">
                                    {validationErrors[name]}
                                </Typography>
                            )}
                        </>
                    ) : (
                        validationErrors[name]
                    )
                }
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                onClick={() => handleToggle(name)}
                                onMouseDown={(e) => e.preventDefault()}
                                edge="end"
                            >
                                {showPassword[name] ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                        </InputAdornment>
                    )
                }}
            />
        );
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400 }}>
            {status && <Alert severity={status.type} sx={{ mb: 2 }}>{status.message}</Alert>}
            {renderPasswordField('currentPassword', 'Current Password')}
            {renderPasswordField('newPassword', 'New Password')}
            {renderPasswordField('confirmPassword', 'Confirm Password')}
            <Button type="submit" variant="contained" color="secondary" sx={{ mt: 2 }}>Update Password</Button>
        </Box>
    );
};

export default AccountPage;