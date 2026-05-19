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
import MenuService from '../../services/menuService';
import { isExternalUrl } from '../../utils/urls';

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
  const [footerMenu, setFooterMenu] = React.useState(null);
  const [logoLoadFailed, setLogoLoadFailed] = React.useState(false);

  React.useEffect(() => {
    const fetchDynamicLinks = async () => {
      const [menuResult, pageResult] = await Promise.allSettled([
        MenuService.getPublicMenu('footer'),
        PageService.getPublicPages('bottom'),
      ]);

      if (menuResult.status === 'fulfilled') {
        setFooterMenu(menuResult.value.data || null);
      } else {
        console.error('Error fetching footer menu:', menuResult.reason);
      }

      if (pageResult.status === 'fulfilled') {
        setDynamicLinks(pageResult.value.data || []);
      } else {
        console.error('Error fetching dynamic footer links:', pageResult.reason);
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

  const flattenMenuItems = (items = [], acc = []) => {
    items.forEach((item) => {
      acc.push(item);
      flattenMenuItems(item.children || [], acc);
    });
    return acc;
  };
  const toFooterLink = (link) => {
    const label = link?.label || link?.title || link?.name || '';
    const url = link?.url || (link?.slug ? `/p/${link.slug}` : '');
    if (!label || !url || url === '#') return null;
    return {
      label,
      url,
      openInNewTab: Boolean(link?.openInNewTab),
    };
  };
  const dedupeLinks = (links) => {
    const seen = new Set();
    return links.filter((link) => {
      const key = `${link.label}|${link.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const menuLinks = flattenMenuItems(footerMenu?.items || [])
    .filter((item) =>
      item.targetType !== 'none' &&
      (!item.placement || ['quick_links', 'footer_column', 'center', 'left', 'right'].includes(item.placement))
    )
    .map(toFooterLink)
    .filter(Boolean);
  const legacyLinks = [
    ...(Array.isArray(f.links) ? f.links : []).map(toFooterLink),
    ...dynamicLinks.map(toFooterLink),
  ].filter(Boolean);
  const allLinks = dedupeLinks(menuLinks.length ? menuLinks : legacyLinks);

  const hasSocial  = f.showSocial  && SOCIAL.some(({ key }) => f[key]);
  const hasLinks   = f.showLinks !== false && allLinks.length > 0;
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
            {settings?.logo?.main && !logoLoadFailed ? (
              <Box sx={{ mb: 1.5 }}>
                <img
                  src={settings.logo.main}
                  alt={general.storeName || 'Store'}
                  style={{ maxHeight: 40, maxWidth: 160, objectFit: 'contain' }}
                  onError={() => setLogoLoadFailed(true)}
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
              <Typography 
                variant="subtitle1" 
                fontWeight={700} 
                sx={{ 
                  mb: 2, 
                  color: fgColor,
                  textAlign: footerMenu?.alignment || 'left'
                }}
              >
                {f.linksTitle || 'Quick Links'}
              </Typography>
              <Stack 
                spacing={1}
                alignItems={
                  footerMenu?.alignment === 'center' ? 'center' : 
                  footerMenu?.alignment === 'right' ? 'flex-end' : 
                  'flex-start'
                }
              >
                {allLinks.map((link, i) => (
                  <MuiLink
                    key={i}
                    component={isExternalUrl(link.url) ? 'a' : RouterLink}
                    {...(isExternalUrl(link.url)
                      ? { href: link.url || '/', target: link.openInNewTab ? '_blank' : undefined, rel: link.openInNewTab ? 'noopener noreferrer' : undefined }
                      : { to: link.url || '/' })}
                    underline="hover"
                    sx={{
                      color: fgColor,
                      opacity: 0.8,
                      fontSize: '0.875rem',
                      textAlign: footerMenu?.alignment || 'left',
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
