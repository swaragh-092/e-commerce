import React from 'react';
import {
  Box, Container, Grid, Typography,
  Link as MuiLink, IconButton, Divider, Stack,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import TwitterIcon from '@mui/icons-material/Twitter';
import YouTubeIcon from '@mui/icons-material/YouTube';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useSettings } from '../../hooks/useSettings';
import { useTheme } from '@mui/material/styles';
import PageService from '../../services/pageService';

const SOCIAL = [
  { key: 'facebook',  Icon: FacebookIcon,  label: 'Facebook'  },
  { key: 'instagram', Icon: InstagramIcon, label: 'Instagram' },
  { key: 'twitter',   Icon: TwitterIcon,   label: 'Twitter'   },
  { key: 'youtube',   Icon: YouTubeIcon,   label: 'YouTube'   },
  { key: 'linkedin',  Icon: LinkedInIcon,  label: 'LinkedIn'  },
];

const StorefrontFooter = () => {
  const { settings } = useSettings();
  const theme = useTheme();
  const [dynamicLinks, setDynamicLinks] = React.useState([]);

  React.useEffect(() => {
    const fetchDynamicLinks = async () => {
      try {
        const response = await PageService.getPublicPages('bottom');
        setDynamicLinks(response.data || []);
      } catch (error) {
        console.error('Error fetching dynamic footer links:', error);
      }
    };
    fetchDynamicLinks();
  }, []);

  const f       = settings?.footer  || {};
  const general = settings?.general || {};

  // Respect the enabled toggle (default: show)
  if (f.enabled === false) return null;

  const bgColor = f.bgColor || theme.palette.background.paper;
  const fgColor = f.fgColor || theme.palette.text.secondary;

  const copyright = (f.copyright || '© {year} {storeName}. All rights reserved.')
    .replace('{year}',      new Date().getFullYear())
    .replace('{storeName}', general.storeName || 'Store');

  const staticLinks = Array.isArray(f.links) ? f.links : [];
  // Merge static links from settings with dynamic links from the Pages module
  const allLinks = [
    ...staticLinks.map(l => ({ label: l.label, url: l.url })),
    ...dynamicLinks.map(p => ({ label: p.title, url: `/p/${p.slug}` }))
  ];

  const hasSocial  = f.showSocial  && SOCIAL.some(({ key }) => f[key]);
  const hasLinks   = (f.showLinks !== false && staticLinks.length > 0) || dynamicLinks.length > 0;
  const hasContact = f.showContact && (f.email || f.phone || f.address);

  const activeCols = [true, hasLinks, hasContact].filter(Boolean).length;
  const brandMd    = activeCols === 1 ? 12 : activeCols === 2 ? 6 : 5;
  const otherMd    = activeCols === 3 ? 3.5 : 6;

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: bgColor,
        color: fgColor,
        borderTop: '1px solid',
        borderColor: 'divider',
        pt: { xs: 5, md: 7 },
        pb: 2,
        mt: 'auto',
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4}>

          {/* ── Brand column ─────────────────────────────────── */}
          <Grid item xs={12} sm={6} md={brandMd}>
            {settings?.logo?.main ? (
              <Box sx={{ mb: 1.5 }}>
                <img
                  src={settings.logo.main}
                  alt={general.storeName || 'Store'}
                  style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </Box>
            ) : (
              <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: fgColor }}>
                {general.storeName || 'Store'}
              </Typography>
            )}

            {f.tagline && (
              <Typography
                variant="body2"
                sx={{ color: fgColor, opacity: 0.75, mb: 2, maxWidth: 300, lineHeight: 1.6 }}
              >
                {f.tagline}
              </Typography>
            )}

            {hasSocial && (
              <Stack direction="row" spacing={0.5} flexWrap="wrap">
                {SOCIAL.map(({ key, Icon, label }) =>
                  f[key] ? (
                    <IconButton
                      key={key}
                      component="a"
                      href={f[key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      size="small"
                      sx={{ color: fgColor, opacity: 0.75, '&:hover': { opacity: 1 } }}
                    >
                      <Icon fontSize="small" />
                    </IconButton>
                  ) : null
                )}
              </Stack>
            )}
          </Grid>

          {/* ── Quick Links column ───────────────────────────── */}
          {hasLinks && (
            <Grid item xs={12} sm={6} md={otherMd}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: fgColor }}>
                {f.linksTitle || 'Quick Links'}
              </Typography>
              <Stack spacing={1}>
                {allLinks.map((link, i) => (
                  <MuiLink
                    key={i}
                    component={RouterLink}
                    to={link.url || '/'}
                    underline="hover"
                    sx={{
                      color: fgColor,
                      opacity: 0.8,
                      fontSize: '0.875rem',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    {link.label}
                  </MuiLink>
                ))}
              </Stack>
            </Grid>
          )}

          {/* ── Contact column ───────────────────────────────── */}
          {hasContact && (
            <Grid item xs={12} sm={6} md={otherMd}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, color: fgColor }}>
                Contact
              </Typography>
              <Stack spacing={1.5}>
                {f.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon fontSize="small" sx={{ color: fgColor, opacity: 0.7, flexShrink: 0 }} />
                    <MuiLink
                      href={`mailto:${f.email}`}
                      underline="hover"
                      sx={{ color: fgColor, opacity: 0.8, fontSize: '0.875rem', '&:hover': { opacity: 1 } }}
                    >
                      {f.email}
                    </MuiLink>
                  </Box>
                )}
                {f.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon fontSize="small" sx={{ color: fgColor, opacity: 0.7, flexShrink: 0 }} />
                    <MuiLink
                      href={`tel:${f.phone}`}
                      underline="hover"
                      sx={{ color: fgColor, opacity: 0.8, fontSize: '0.875rem', '&:hover': { opacity: 1 } }}
                    >
                      {f.phone}
                    </MuiLink>
                  </Box>
                )}
                {f.address && (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <LocationOnIcon fontSize="small" sx={{ color: fgColor, opacity: 0.7, flexShrink: 0, mt: 0.1 }} />
                    <Typography
                      variant="body2"
                      sx={{ color: fgColor, opacity: 0.8, whiteSpace: 'pre-line' }}
                    >
                      {f.address}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Grid>
          )}

        </Grid>

        <Divider sx={{ my: 3, opacity: 0.25 }} />

        <Typography
          variant="caption"
          sx={{ color: fgColor, opacity: 0.6, display: 'block', textAlign: 'center' }}
        >
          {copyright}
        </Typography>
      </Container>
    </Box>
  );
};

export default StorefrontFooter;
