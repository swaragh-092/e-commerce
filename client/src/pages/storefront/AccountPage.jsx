import React, { useState, useContext } from 'react';
import { Box, Typography, Tabs, Tab, Paper, Container, TextField, Button, Alert } from '@mui/material';
import { AuthContext } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import AvatarUploader from '../../components/common/AvatarUploader';
import PageSEO from '../../components/common/PageSEO';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const AccountPage = () => {
    const { user, updateProfile } = useContext(AuthContext);
    const [tab, setTab] = useState(0);

    const handleTabChange = (event, newValue) => setTab(newValue);

    if (!user) return null;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <PageSEO title="My Account" type="noindex" />
            <Typography variant="h4" gutterBottom>My Account</Typography>
            <Paper sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                        <Tab label="Profile" />
                        <Tab label="Addresses" />
                        <Tab label="Password" />
                        <Tab label="Orders" />
                    </Tabs>
                </Box>
                <TabPanel value={tab} index={0}>
                    <ProfileTab user={user} updateProfile={updateProfile} />
                </TabPanel>
                <TabPanel value={tab} index={1}>
                    <Typography>Addresses management coming soon...</Typography>
                </TabPanel>
                <TabPanel value={tab} index={2}>
                    <PasswordTab />
                </TabPanel>
                <TabPanel value={tab} index={3}>
                    <Typography>Order history coming soon...</Typography>
                </TabPanel>
            </Paper>
        </Container>
    );
};

const ProfileTab = ({ user, updateProfile }) => {
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phone: user?.UserProfile?.phone || '',
    });
    const [status, setStatus] = useState(null);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await updateProfile(formData);
            setStatus({ type: 'success', message: 'Profile updated successfully' });
        } catch (error) {
            setStatus({ type: 'error', message: error?.response?.data?.message || 'Update failed' });
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400 }}>
            <AvatarUploader />
            {status && <Alert severity={status.type} sx={{ mb: 2 }}>{status.message}</Alert>}
            <TextField fullWidth label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} margin="normal" required />
            <TextField fullWidth label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} margin="normal" required />
            <TextField fullWidth label="Phone" name="phone" value={formData.phone} onChange={handleChange} margin="normal" />
            <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>Save Changes</Button>
        </Box>
    );
};

const PasswordTab = () => {
    const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
    const [status, setStatus] = useState(null);

    const handleChange = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await userService.changePassword(passwords);
            setStatus({ type: 'success', message: 'Password changed successfully' });
            setPasswords({ currentPassword: '', newPassword: '' });
        } catch (error) {
            setStatus({ type: 'error', message: error?.response?.data?.message || 'Password change failed' });
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 400 }}>
            {status && <Alert severity={status.type} sx={{ mb: 2 }}>{status.message}</Alert>}
            <TextField fullWidth type="password" label="Current Password" name="currentPassword" value={passwords.currentPassword} onChange={handleChange} margin="normal" required />
            <TextField fullWidth type="password" label="New Password" name="newPassword" value={passwords.newPassword} onChange={handleChange} margin="normal" required />
            <Button type="submit" variant="contained" color="secondary" sx={{ mt: 2 }}>Update Password</Button>
        </Box>
    );
}

export default AccountPage;
