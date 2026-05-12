import React, { createContext, useContext, useState, useCallback } from 'react';
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
  Typography
} from '@mui/material';

const NotificationContext = createContext(null);
const DEFAULT_CONFIRM_TEXT = 'Confirm';
const DEFAULT_CANCEL_TEXT = 'Cancel';

const isRenderable = (value) => (
  React.isValidElement(value) ||
  ['string', 'number'].includes(typeof value)
);

const toRenderableText = (value, fallback = '') => {
  if (isRenderable(value)) return value;
  if (value == null || value === false) return fallback;
  return String(value);
};

const getButtonColor = (severity) => {
  if (severity === 'danger' || severity === 'error') return 'error';
  if (severity === 'warning') return 'warning';
  if (severity === 'success') return 'success';
  return 'primary';
};

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
    severity: 'primary',
    confirmText: DEFAULT_CONFIRM_TEXT,
    cancelText: DEFAULT_CANCEL_TEXT,
  });

  const notify = useCallback((message, severity = 'info', action = null) => {
    const validatedAction = (action && typeof action.label === 'string' && typeof action.callback === 'function') 
      ? action 
      : null;
    setNotification({ message, severity, action: validatedAction, key: Date.now() });
  }, []);


  const confirm = useCallback((titleOrOptions, message, severity = 'primary') => {
    return new Promise((resolve) => {
      const options = titleOrOptions && typeof titleOrOptions === 'object' && !React.isValidElement(titleOrOptions)
        ? titleOrOptions
        : { title: titleOrOptions, message, severity };

      setConfirmDialog({
        open: true,
        title: toRenderableText(options.title, 'Confirm Action'),
        message: toRenderableText(options.message),
        resolve,
        severity: options.severity || 'primary',
        confirmText: toRenderableText(options.confirmText, DEFAULT_CONFIRM_TEXT),
        cancelText: toRenderableText(options.cancelText, DEFAULT_CANCEL_TEXT),
      });
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
        autoHideDuration={notification?.action ? 6000 : 4000}
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
          action={notification?.action ? (
            <Button 
              color="inherit" 
              size="small" 
              onClick={async () => {
                try {
                  if (notification?.action?.callback) {
                    await notification.action.callback();
                  }
                } catch (err) {
                  console.error('Notification action callback failed:', err);
                } finally {
                  handleNotifyClose(null, 'action');
                }
              }}

              sx={{ fontWeight: 700 }}
            >
              {notification.action.label}
            </Button>
          ) : null}
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
        <DialogTitle id="confirm-dialog-title" component="div" sx={{ pb: 1 }}>
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
            {confirmDialog.cancelText}
          </Button>
          <Button 
            onClick={() => handleConfirmClose(true)} 
            variant="contained" 
            color={getButtonColor(confirmDialog.severity)}
            autoFocus
            sx={{ 
              borderRadius: '8px',
              padding: '6px 24px',
              fontWeight: 600,
              boxShadow: getButtonColor(confirmDialog.severity) === 'error' ? '0 4px 14px 0 rgba(211, 47, 47, 0.39)' : '0 4px 14px 0 rgba(25, 118, 210, 0.39)'
            }}
          >
            {confirmDialog.confirmText}
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
