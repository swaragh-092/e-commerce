import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { 
  Snackbar, 
  Alert, 
  Slide, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions, 
  Button,
  Box,
  Typography
} from '@mui/material';

const NotificationContext = createContext(null);

function SlideTransition(props) {
  return <Slide {...props} direction="up" />;
}

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ 
    open: false, 
    title: '', 
    message: '', 
    resolve: null,
    severity: 'primary' 
  });

  const notify = useCallback((message, severity = 'info') => {
    setNotification({ message, severity, key: Date.now() });
  }, []);

  const confirm = useCallback((title, message, severity = 'primary') => {
    return new Promise((resolve) => {
      setConfirmDialog({ open: true, title, message, resolve, severity });
    });
  }, []);

  const handleNotifyClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setNotification(null);
  };

  const handleConfirmClose = (value) => {
    if (confirmDialog.resolve) {
      confirmDialog.resolve(value);
    }
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  return (
    <NotificationContext.Provider value={{ notify, confirm }}>
      {children}
      
      {/* Toast Notification */}
      <Snackbar
        key={notification?.key}
        open={Boolean(notification)}
        autoHideDuration={4000}
        onClose={handleNotifyClose}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleNotifyClose}
          severity={notification?.severity || 'info'}
          variant="filled"
          elevation={6}
          sx={{ width: '100%', minWidth: 300, borderRadius: '12px' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => handleConfirmClose(false)}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        PaperProps={{
          sx: {
            borderRadius: '16px',
            padding: '8px',
            minWidth: '400px'
          }
        }}
      >
        <DialogTitle id="confirm-dialog-title" sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            {confirmDialog.title}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          <DialogContentText id="confirm-dialog-description">
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => handleConfirmClose(false)} 
            sx={{ color: 'text.secondary', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => handleConfirmClose(true)} 
            variant="contained" 
            color={confirmDialog.severity === 'danger' ? 'error' : 'primary'}
            autoFocus
            sx={{ 
              borderRadius: '8px',
              padding: '6px 24px',
              fontWeight: 600,
              boxShadow: confirmDialog.severity === 'danger' ? '0 4px 14px 0 rgba(211, 47, 47, 0.39)' : '0 4px 14px 0 rgba(25, 118, 210, 0.39)'
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};
