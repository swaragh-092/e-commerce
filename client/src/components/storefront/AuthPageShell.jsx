import { Box, Paper, Typography, useTheme } from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LockPersonIcon from '@mui/icons-material/LockPerson';
import { useSettings } from '../../hooks/useSettings';
import { getMediaUrl } from '../../utils/media';

const DEFAULT_AUTH_IMAGE = 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=1400&q=80';

const defaults = {
  login: {
    title: 'Step Back Into Your Favorites',
    description: 'Log in to access your orders, wishlist and personalized picks.',
    formTitle: 'Log In',
    formSubtitle: 'Welcome back! Please enter your details.',
  },
  register: {
    title: 'Create Your Everyday Storefront',
    description: 'Sign up to save favorites, track orders and checkout faster.',
    formTitle: 'Create Account',
    formSubtitle: 'Join us today. Please enter your details.',
  },
  admin: {
    title: 'Manage Your Store With Confidence',
    description: 'Sign in to review orders, update products and keep daily operations moving.',
    formTitle: 'Staff Portal',
    formSubtitle: 'Sign in to access the administrative dashboard.',
  },
};

const AuthPageShell = ({ type = 'login', fullHeight = false, children }) => {
  const theme = useTheme();
  const { settings } = useSettings();
  const authSettings = settings?.auth || {};
  const copy = defaults[type] || defaults.login;
  const image = authSettings.image || DEFAULT_AUTH_IMAGE;
  const accent = theme.palette.primary.main;
  const headingColor = authSettings[`${type}HeadingColor`] || authSettings.headingColor || theme.palette.primary.main;
  const descriptionColor = authSettings[`${type}DescriptionColor`] || authSettings.descriptionColor || theme.palette.primary.main;

  const heading = authSettings[`${type}Heading`] || copy.title;
  const description = authSettings[`${type}Description`] || copy.description;
  const formTitle = authSettings[`${type}FormTitle`] || copy.formTitle;
  const formSubtitle = authSettings[`${type}FormSubtitle`] || copy.formSubtitle;
  const Icon = type === 'register'
    ? PersonAddAltOutlinedIcon
    : type === 'admin'
      ? AdminPanelSettingsOutlinedIcon
      : LockPersonIcon;

  return (
    <Box
      sx={{
        minHeight: fullHeight ? '100svh' : { xs: 'calc(100svh - 64px)', md: 'calc(100svh - 72px)' },
        display: 'flex',
        alignItems: 'center',
        bgcolor: '#fffaf2',
        backgroundImage: `linear-gradient(90deg, rgba(255,250,242,0.68) 0%, rgba(255,250,242,0.56) 36%, rgba(255,250,242,0.38) 58%, rgba(255,250,242,0.7) 100%), url(${getMediaUrl(image)})`,
        backgroundSize: 'cover',
        backgroundPosition: authSettings.imagePosition || 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
        px: { xs: 2.5, sm: 4, lg: 7 },
        py: { xs: 5, md: 7 },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1360,
          mx: 'auto',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(300px, 0.9fr) minmax(400px, 1fr)' },
          alignItems: 'center',
          gap: { xs: 5, md: 8, xl: 12 },
        }}
      >
        <Box sx={{ maxWidth: { xs: 520, md: 430 }, justifySelf: { xs: 'center', md: 'start' }, textAlign: { xs: 'center', md: 'left' } }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: '"Playfair Display", "Georgia", "Times New Roman", serif',
              fontSize: { xs: 36, sm: 44, md: 48, xl: 56 },
              lineHeight: 1.04,
              fontWeight: 900,
              color: headingColor,
              letterSpacing: 0,
              textShadow: '0 2px 18px rgba(255, 250, 242, 0.7)',
            }}
          >
            {heading}
          </Typography>
          <Box sx={{ width: 18, height: 2, bgcolor: accent, my: 3, mx: { xs: 'auto', md: 0 } }} />
          <Typography
            sx={{
              color: descriptionColor,
              lineHeight: 1.7,
              fontSize: { xs: 15, md: 16, xl: 17 },
              fontWeight: 500,
              textShadow: '0 1px 12px rgba(255, 250, 242, 0.68)',
            }}
          >
            {description}
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: type === 'register' ? 540 : 470,
            justifySelf: { xs: 'center', md: 'center' },
            p: { xs: 3.25, sm: 4.5 },
            borderRadius: '18px',
            border: '1px solid rgba(15, 118, 110, 0.08)',
            boxShadow: '0 24px 70px rgba(31, 41, 51, 0.12)',
            position: 'relative',
            bgcolor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box
            sx={{
              width: 58,
              height: 58,
              borderRadius: '50%',
              bgcolor: 'rgba(15, 118, 110, 0.11)',
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
            }}
          >
            <Icon />
          </Box>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography component="h2" fontWeight={800} sx={{ color: accent, mb: 1, fontSize: { xs: 28, sm: 31 }, letterSpacing: 0 }}>
              {formTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14 }}>
              {formSubtitle}
            </Typography>
          </Box>
          {children}
        </Paper>
      </Box>
    </Box>
  );
};

export default AuthPageShell;
