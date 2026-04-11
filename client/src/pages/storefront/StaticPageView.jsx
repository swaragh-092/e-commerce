import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Breadcrumbs,
  Link,
  Paper,
} from '@mui/material';
import PageService from '../../services/pageService';
import { getMediaUrl } from '../../utils/media';
import { Helmet } from 'react-helmet-async';

const StaticPageView = () => {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await PageService.getPageBySlug(slug);
        setPage(response.data);
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Page not found');
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !page) {
    return (
      <Container sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          404 - Page Not Found
        </Typography>
        <Typography color="text.secondary">
          The page you are looking for does not exist or has been moved.
        </Typography>
        <Link href="/" sx={{ mt: 2, display: 'inline-block' }}>
          Back to Home
        </Link>
      </Container>
    );
  }

  return (
    <Box>
      <Helmet>
        <title>{page.metaTitle || page.title}</title>
        {page.metaDescription && <meta name="description" content={page.metaDescription} />}
      </Helmet>

      {/* Banner Section */}
      {page.bannerUrl ? (
        <Box
          sx={{
            height: { xs: '200px', md: '350px' },
            position: 'relative',
            backgroundImage: `url(${getMediaUrl(page.bannerUrl)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            mb: 4,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0,0,0,0.4)',
            },
          }}
        >
          <Container sx={{ position: 'relative', zIndex: 1, color: 'white' }}>
            <Typography variant="h2" component="h1" fontWeight={700}>
                {page.title}
            </Typography>
          </Container>
        </Box>
      ) : (
        <Container sx={{ mt: 4 }}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link href="/" underline="hover" color="inherit">Home</Link>
            <Typography color="text.primary">{page.title}</Typography>
          </Breadcrumbs>
          <Typography variant="h3" component="h1" fontWeight={700} gutterBottom>
            {page.title}
          </Typography>
        </Container>
      )}

      {/* Content Section */}
      <Container sx={{ pb: 8 }}>
        <Paper elevation={0} sx={{ p: { xs: 0, md: 4 }, bgcolor: 'transparent' }}>
          <Box
            className="page-content"
            sx={{
              '& h2': { mt: 4, mb: 2, fontWeight: 700 },
              '& h3': { mt: 3, mb: 1.5, fontWeight: 600 },
              '& p': { mb: 2, lineHeight: 1.7 },
              '& ul, & ol': { mb: 2, pl: 4 },
              '& li': { mb: 1 },
              '& img': { maxWidth: '100%', height: 'auto', borderRadius: 2 },
            }}
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default StaticPageView;
