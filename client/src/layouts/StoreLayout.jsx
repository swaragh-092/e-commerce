import { Box } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import StorefrontHeader from '../components/layout/StorefrontHeader';
import StorefrontFooter from '../components/layout/StorefrontFooter';
import SEO from '../components/common/SEO';

const StoreLayout = () => {
  const location = useLocation();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SEO />
      <Box
        component="a"
        href="#main"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 0,
          zIndex: 1300,
          bgcolor: 'primary.main',
          color: '#fff',
          px: 2,
          py: 1,
          borderRadius: 1,
          '&:focus': { left: 8, top: 8 },
        }}
      >
        Skip to content
      </Box>
      <StorefrontHeader />
      <Box component="main" id="main" tabIndex={-1} sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
      {!isAuthPage && <StorefrontFooter />}
    </Box>
  );
};

export default StoreLayout;
