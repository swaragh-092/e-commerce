import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Typography } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { orderService } from '../../services/orderService';
import { getApiErrorMessage } from '../../utils/apiErrors';

const LinkGuestOrdersPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState({ loading: false, claiming: false, error: '', linkedCount: null });

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setState({ loading: false, claiming: false, error: 'This order-linking link is invalid or incomplete.', linkedCount: null });
    }
  }, [token]);

  const confirmClaim = async () => {
    setState((current) => ({ ...current, claiming: true, error: '' }));
    try {
      const response = await orderService.claimGuestOrders(token);
      setState({ loading: false, claiming: false, error: '', linkedCount: response.data?.linkedCount ?? 0 });
    } catch (error) {
      setState({ loading: false, claiming: false, error: getApiErrorMessage(error, 'We could not link guest orders. Request a new link and try again.'), linkedCount: null });
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={750} gutterBottom>Guest orders</Typography>
        {state.loading || state.claiming ? <CircularProgress /> : state.error ? (
          <Alert severity="error" sx={{ my: 3 }}>{state.error}</Alert>
        ) : state.linkedCount !== null ? (
          <Alert severity="success" sx={{ my: 3 }}>
            {state.linkedCount === 0 ? 'No eligible guest orders were found for this verified email.' : `${state.linkedCount} guest order${state.linkedCount === 1 ? '' : 's'} linked to your account.`}
          </Alert>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ my: 2 }}>Confirm to attach eligible guest orders made with this verified account email. This link works once and expires after 30 minutes.</Typography>
            <Button onClick={confirmClaim} variant="contained" disabled={!/^[a-f0-9]{64}$/i.test(token)}>Confirm and link orders</Button>
          </>
        )}
        {!state.loading && state.linkedCount !== null && <Button component={RouterLink} to="/orders" variant="contained">View my orders</Button>}
      </Box>
    </Container>
  );
};

export default LinkGuestOrdersPage;
