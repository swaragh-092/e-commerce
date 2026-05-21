import { useEffect, useState } from 'react';
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Link as MuiLink,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import PageSEO from '../../components/common/PageSEO';
import BlogService from '../../services/blogService';
import { getMediaUrl } from '../../utils/media';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
};

const BlogCardSkeleton = () => (
  <Card sx={{ height: '100%', borderRadius: 4 }}>
    <Skeleton variant="rectangular" height={220} />
    <CardContent sx={{ p: 3 }}>
      <Skeleton variant="text" height={36} width="80%" />
      <Skeleton variant="text" height={24} width="40%" />
      <Skeleton variant="text" height={20} />
      <Skeleton variant="text" height={20} width="92%" />
      <Skeleton variant="rounded" height={38} width={120} sx={{ mt: 2 }} />
    </CardContent>
  </Card>
);

const BlogsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const categorySlug = searchParams.get('category') || '';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [postsRes, categoriesRes] = await Promise.all([
          BlogService.getPublicPosts({ page, limit: 9, categorySlug }),
          BlogService.getPublicCategories(),
        ]);
        setPosts(postsRes.data || []);
        setMeta(postsRes.meta || { page: 1, totalPages: 1, total: 0 });
        setCategories(categoriesRes.data || []);
      } catch (error) {
        setPosts([]);
        setCategories([]);
        setMeta({ page: 1, totalPages: 1, total: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, categorySlug]);

  const updateParams = (nextPage, nextCategory) => {
    const params = new URLSearchParams();
    if (nextPage > 1) params.set('page', String(nextPage));
    if (nextCategory) params.set('category', nextCategory);
    setSearchParams(params);
  };

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
      <PageSEO title="Blogs" description="Read the latest stories, updates, and guides from our store." />

      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={RouterLink} underline="hover" color="inherit" to="/">
          Home
        </MuiLink>
        <Typography color="text.primary">Blogs</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Blogs
        </Typography>
        {!loading && (
          <Typography variant="body2" color="text.secondary">
            {meta.total} post{meta.total === 1 ? '' : 's'}{categorySlug ? ' in this category' : ''}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 4, flexWrap: 'wrap', gap: 1 }}>
        <Chip
          label="All"
          clickable
          color={!categorySlug ? 'primary' : 'default'}
          onClick={() => updateParams(1, '')}
          sx={{ fontWeight: 600 }}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            clickable
            color={categorySlug === category.slug ? 'primary' : 'default'}
            onClick={() => updateParams(1, category.slug)}
            sx={{ fontWeight: 600 }}
          />
        ))}
      </Stack>

      <Grid container spacing={3}>
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Grid item xs={12} md={6} lg={4} key={index}>
                <BlogCardSkeleton />
              </Grid>
            ))
          : posts.map((post) => (
              <Grid item xs={12} md={6} lg={4} key={post.id}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 18px 48px rgba(0,0,0,0.10)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 220,
                      background: post.featuredImage?.url
                        ? `url(${getMediaUrl(post.featuredImage.url)}) center/cover no-repeat`
                        : 'linear-gradient(135deg, #d8ecef 0%, #f1dfc3 100%)',
                    }}
                  />
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100% - 220px)' }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                      {(post.categories || []).slice(0, 2).map((category) => (
                        <Chip key={category.id} label={category.name} size="small" variant="outlined" />
                      ))}
                    </Stack>
                    <Typography variant="h5" fontWeight={800} sx={{ mb: 1.2, lineHeight: 1.25 }}>
                      {post.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, letterSpacing: '0.04em' }}>
                      {formatDate(post.displayDate || post.publishedAt)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, flexGrow: 1 }}>
                      {post.summary || 'Read the full article for more details.'}
                    </Typography>
                    <Button
                      component={RouterLink}
                      to={`/blogs/${post.slug}`}
                      variant="contained"
                      sx={{ mt: 2.5, alignSelf: 'flex-start', borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}
                    >
                      Read Article
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
      </Grid>

      {!loading && posts.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={800} gutterBottom>
            No blog posts found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            There are no published posts in this section yet.
          </Typography>
          {categorySlug ? (
            <Button variant="outlined" onClick={() => updateParams(1, '')}>
              View all posts
            </Button>
          ) : null}
        </Box>
      )}

      {meta.totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <Pagination
            count={meta.totalPages}
            page={meta.page}
            onChange={(_, nextPage) => updateParams(nextPage, categorySlug)}
            color="primary"
            size="large"
          />
        </Box>
      )}
    </Container>
  );
};

export default BlogsPage;
