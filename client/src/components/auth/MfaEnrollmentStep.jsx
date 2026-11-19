import { Alert, Box, Button, Typography } from '@mui/material';
import TwoFactorSetup from '../storefront/TwoFactorSetup';
import authService from '../../services/authService';

const MfaEnrollmentStep = ({ enrollmentToken, onComplete, onBack }) => (
  <Box>
    <Typography variant="h6" component="h1" sx={{ mb: 1 }}>Set up your authenticator</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      Your role requires MFA. Set up an authenticator app now to finish signing in.
    </Typography>
    <Alert severity="info" sx={{ mb: 2 }}>
      Use Google Authenticator, Microsoft Authenticator, Authy, or another code-generating app. Email and recovery codes cannot replace this first setup step.
    </Alert>
    <TwoFactorSetup
      embedded
      user={{ twoFactorEnabled: false }}
      setupRequest={() => authService.setupMfaEnrollment(enrollmentToken)}
      enableRequest={(code) => authService.enableMfaEnrollment(enrollmentToken, code)}
      onComplete={onComplete}
    />
    <Button type="button" variant="text" onClick={onBack} sx={{ mt: 1 }}>
      Back to sign in
    </Button>
  </Box>
);

export default MfaEnrollmentStep;
