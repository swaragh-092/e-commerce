import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Container,
  Divider,
  Link as MuiLink,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageSEO from '../../components/common/PageSEO';
import BlogService from '../../services/blogService';
import { getMediaUrl } from '../../utils/media';
import { useSettings } from '../../hooks/useSettings';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
};

const BlogDetailPage = () => {
  const { slug } = useParams();
  const { settings } = useSettings();
  const blogPage = settings?.blogPage || {};
  const articleLayout = blogPage.articleLayout || 'standard';
  const showAuthor = blogPage.showAuthor !== false;
  const showDate = blogPage.showDate !== false;
  const useCoverLayout = articleLayout === 'cover';
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      try {
        const response = await BlogService.getPublicPostBySlug(slug);
        setPost(response.data || null);
      } catch (error) {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  if (!loading && !post) {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" fontWeight={800} gutterBottom>
          Blog post not found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The article you are looking for is unavailable or not published yet.
        </Typography>
        <Button component={RouterLink} to="/blogs" variant="contained">
          Back to Blogs
        </Button>
      </Container>
    );
  }

  const heroImage = post?.featuredImage?.url ? getMediaUrl(post.featuredImage.url) : '';
  const authorName = [post?.author?.firstName, post?.author?.lastName].filter(Boolean).join(' ');

  return (
    <Container maxWidth={useCoverLayout ? 'xl' : 'lg'} sx={{ py: { xs: 4, md: 6 } }}>
      <PageSEO
        title={post?.metaTitle || post?.title || 'Blog'}
        description={post?.metaDescription || post?.summary || 'Read this blog post.'}
        image={heroImage || undefined}
        url={typeof window !== 'undefined' ? window.location.href : undefined}
      />

      <Breadcrumbs sx={{ mb: 3 }}>
        <MuiLink component={RouterLink} underline="hover" color="inherit" to="/">
          Home
        </MuiLink>
        <MuiLink component={RouterLink} underline="hover" color="inherit" to="/blogs">
          Blogs
        </MuiLink>
        <Typography color="text.primary">{loading ? 'Loading...' : post?.title}</Typography>
      </Breadcrumbs>

      {loading ? (
        <Box>
          <Skeleton variant="text" width="20%" height={28} />
          <Skeleton variant="text" width="70%" height={72} />
          <Skeleton variant="text" width="35%" height={28} />
          <Skeleton variant="rounded" height={420} sx={{ my: 3, borderRadius: 4 }} />
          <Skeleton variant="text" height={30} />
          <Skeleton variant="text" height={30} />
          <Skeleton variant="text" height={30} width="90%" />
        </Box>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            {(post.categories || []).map((category) => (
              <Chip
                key={category.id}
                label={category.name}
                clickable
                component={RouterLink}
                to={`/blogs?category=${category.slug}`}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>

          {useCoverLayout && heroImage ? (
            <Box
              sx={{
                minHeight: { xs: 340, md: 560 },
                borderRadius: 4,
                mb: 5,
                p: { xs: 3, md: 6 },
                display: 'flex',
                alignItems: 'flex-end',
                background: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.16)), url(${heroImage}) center/cover no-repeat`,
                color: '#fff',
              }}
            >
              <Box sx={{ maxWidth: 880 }}>
                <Typography variant="h2" component="h1" fontWeight={900} sx={{ mb: 2, lineHeight: 1.05 }}>
                  {post.title}
                </Typography>
                {(showDate || (showAuthor && authorName)) && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: post.summary ? 2 : 0, color: 'rgba(255,255,255,0.82)' }}>
                    {showDate && <Typography variant="body2">{formatDate(post.displayDate || post.publishedAt)}</Typography>}
                    {showAuthor && authorName ? <Typography variant="body2">By {authorName}</Typography> : null}
                  </Stack>
                )}
                {post.summary ? <Typography variant="body1" sx={{ maxWidth: 760, lineHeight: 1.8, color: 'rgba(255,255,255,0.86)' }}>{post.summary}</Typography> : null}
              </Box>
            </Box>
          ) : (
            <>
              <Typography variant="h3" component="h1" fontWeight={800} sx={{ mb: 2 }}>
                {post.title}
              </Typography>

              {(showDate || (showAuthor && authorName)) && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3, color: 'text.secondary' }}>
                  {showDate && <Typography variant="body2">{formatDate(post.displayDate || post.publishedAt)}</Typography>}
                  {showAuthor && authorName ? <Typography variant="body2">By {authorName}</Typography> : null}
                </Stack>
              )}

              {post.summary ? (
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 4, maxWidth: 880, lineHeight: 1.8 }}
                >
                  {post.summary}
                </Typography>
              ) : null}

              {heroImage ? (
                <Box
                  sx={{
                    height: { xs: 260, md: 480 },
                    borderRadius: 4,
                    mb: 5,
                    background: `url(${heroImage}) center/cover no-repeat`,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              ) : null}
            </>
          )}

          <Divider sx={{ mb: 4 }} />

          <Box
            sx={{
              '& p': { mb: 2.2, lineHeight: 1.9, color: 'text.primary', fontSize: '1rem' },
              '& h1, & h2, & h3, & h4': { mt: 4, mb: 2, fontWeight: 800, lineHeight: 1.2 },
              '& ul, & ol': { pl: 3, mb: 3 },
              '& li': { mb: 1 },
              '& img': { maxWidth: '100%', height: 'auto', borderRadius: 3, my: 2 },
              '& blockquote': {
                my: 3,
                mx: 0,
                pl: 2.5,
                py: 1,
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                color: 'text.secondary',
                bgcolor: 'action.hover',
              },
              '& a': { color: 'primary.main' },
            }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content || '') }}
          />

          {post.gallery?.items?.length ? (
            <Box sx={{ mt: 6 }}>
              <Typography variant="h5" component="h2" fontWeight={700} sx={{ mb: 2.5 }}>
                {post.gallery.title || 'Gallery'}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                  gap: 2,
                }}
              >
                {post.gallery.items.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box
                      component="img"
                      src={getMediaUrl(item.media?.url)}
                      alt={item.media?.alt || item.media?.caption || post.title}
                      sx={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
                    />
                    {item.media?.caption ? (
                      <Box sx={{ p: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item.media.caption}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}

          <Box sx={{ mt: 6 }}>
            <Button component={RouterLink} to="/blogs" variant="outlined">
              More Articles
            </Button>
          </Box>
        </>
      )}
    </Container>
  );
};

export default BlogDetailPage;
