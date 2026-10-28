import { useEffect, useState } from 'react';
import { Alert, Button, Container, Skeleton, Stack, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import ProductListPage from './ProductListPage';
import PageSEO from '../../components/common/PageSEO';
import { getPublicTag } from '../../services/tagService';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function TagPage() {
  const { slug } = useParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ slug, loading: true });
  useEffect(() => {
    let active = true;
    setState({ slug, loading: true });
    getPublicTag(slug).then((res) => {
      if (!res.data?.slug) throw new Error('Could not load tag.');
      if (active) setState({ slug, loading: false, tag: res.data });
    }).catch((error) => {
      if (active) setState({ slug, loading: false, error, notFound: [400, 404].includes(error.response?.status) });
    });
    return () => { active = false; };
  }, [slug, revision]);

  if (state.slug !== slug || state.loading) return (
    <Container sx={{ py: 4 }} role="status" aria-label="Loading tag">
      <Skeleton variant="text" width="40%" height={60} />
      <Skeleton variant="rectangular" height={240} />
    </Container>
  );
  if (state.error) return (
    <Container sx={{ py: 4 }}>
      <PageSEO title={state.notFound ? 'Tag not found' : 'Tag unavailable'} type="noindex" />
      <Typography variant="h4" component="h1" gutterBottom>{state.notFound ? 'Tag not found' : 'Unable to load this tag'}</Typography>
      <Alert severity={state.notFound ? 'info' : 'error'} sx={{ mb: 2 }}>
        {state.notFound ? 'This tag is no longer available. Browse the catalog to find more products.' : getApiErrorMessage(state.error, 'Please try again.')}
      </Alert>
      <Stack direction="row" spacing={2}>
        {!state.notFound && <Button variant="contained" onClick={() => setRevision((current) => current + 1)}>Retry</Button>}
        <Button component={Link} to="/products">Browse products</Button>
      </Stack>
    </Container>
  );
  return <ProductListPage key={state.tag.slug} tag={state.tag} />;
}
