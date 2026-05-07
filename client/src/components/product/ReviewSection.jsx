import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Rating, TextField, Divider, Avatar, List, ListItem, ListItemAvatar, ListItemText, Alert, CircularProgress, Tooltip } from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import { Link as RouterLink } from 'react-router-dom';
import { reviewService } from '../../services/reviewService';
import { useAuth } from '../../hooks/useAuth';
import { orderService } from '../../services/orderService';
import { useFeature } from '../../hooks/useSettings';

const ReviewSection = ({ slug, productId }) => {
    const reviewsEnabled = useFeature('reviews');
    const requirePurchase = useFeature('requirePurchaseForReview');
    
    if (!reviewsEnabled) return null;
    
    const [reviews, setReviews] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ rating: 0, title: '', body: '', orderId: null });
    const { isAuthenticated } = useAuth();
    const [submitStatus, setSubmitStatus] = useState(null);
    const [hasPurchased, setHasPurchased] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [purchaseCheckError, setPurchaseCheckError] = useState(false);

    const canWriteReview = isAuthenticated && (!requirePurchase || hasPurchased);

    const fetchReviews = async (pageNum = 1) => {
        if (pageNum === 1) {
            setLoading(true);
            setError(null);
        } else {
            setLoadingMore(true);
        }
        try {
            const res = await reviewService.list(slug, { page: pageNum, limit: 10 });
            const rawData = res.data || [];
            const newReviews = Array.isArray(rawData) ? rawData : (rawData.rows || []);

            if (pageNum === 1) {
                setReviews(newReviews);
            } else {
                setReviews(prev => [...prev, ...newReviews]);
            }
            const totalPages = res.meta?.totalPages || 1;
            setHasMore(pageNum < totalPages);
            setPage(pageNum);
        } catch (e) {
            console.error('Failed to load reviews', e);
            if (pageNum === 1) {
                setError('Failed to load reviews. Please try again later.');
            }
        } finally {
            if (pageNum === 1) setLoading(false);
            else setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchReviews(1);
    }, [slug]);

    // Fetch user's orders to find a verified purchase orderId for this product
    useEffect(() => {
        if (!isAuthenticated || !productId) return;
        setPurchaseCheckError(false);
        // Call backend with productId and status filter to reliably find a purchase
        // even if it's beyond the last 50 generic orders.
        orderService.getMyOrders({ productId, status: 'delivered', limit: 1 })
            .then((res) => {
                const responseData = res.data || {};
                const orders = Array.isArray(responseData) ? responseData : (responseData.rows || []);
                
                if (orders.length > 0) {
                    const order = orders[0];
                    setFormData(prev => ({ ...prev, orderId: order.id }));
                    setHasPurchased(true);
                }
            })
            .catch((err) => {
                console.error('Failed to verify purchase history', err);
                setPurchaseCheckError(true);
            });
    }, [isAuthenticated, productId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title?.trim() && !formData.body?.trim()) {
            setSubmitStatus({ type: 'error', message: 'Please provide either a title or a review body.' });
            return;
        }

        setSubmitStatus(null);
        setSubmitting(true);
        try {
            await reviewService.create(slug, formData);
            setSubmitStatus({ type: 'success', message: 'Thank you for submitting your review!' });
            setFormData(prev => ({ ...prev, rating: 0, title: '', body: '' }));
            setShowForm(false);
            fetchReviews(1); // refresh reviews list
        } catch (error) {
            setSubmitStatus({ type: 'error', message: error?.response?.data?.message || 'Review submission failed' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>Customer Reviews</Typography>

            {isAuthenticated ? (
                <>
                    {requirePurchase && !hasPurchased ? (
                        purchaseCheckError ? (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                We couldn't verify your purchase history at this time. Please try again later.
                            </Alert>
                        ) : (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Only verified purchasers can leave a review for this product.
                            </Alert>
                        )
                    ) : (
                        <Button variant="outlined" onClick={() => setShowForm(!showForm)}>
                            {showForm ? 'Cancel' : 'Write a Review'}
                        </Button>
                    )}
                </>
            ) : (
                <Button component={RouterLink} to="/login" variant="outlined" color="primary">
                    Login to Write a Review
                </Button>
            )}

            {submitStatus && (
                <Alert severity={submitStatus.type} sx={{ mt: 2 }} onClose={() => setSubmitStatus(null)}>
                    {submitStatus.message}
                </Alert>
            )}

            {showForm && (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, p: 3, border: '1px solid #ddd', borderRadius: 2 }}>
                    {formData.orderId && (
                        <Alert severity="info" sx={{ mb: 2 }}>Verified purchase found — your review will be marked as verified.</Alert>
                    )}
                    <Typography component="legend" color="text.primary" fontWeight="medium">Rating (Required)</Typography>
                    <Rating
                        name="rating"
                        value={formData.rating}
                        onChange={(event, newValue) => setFormData({ ...formData, rating: newValue })}
                    />
                    <TextField 
                        fullWidth 
                        margin="normal" 
                        label="Review Title" 
                        value={formData.title} 
                        onChange={e => setFormData({ ...formData, title: e.target.value })} 
                        inputProps={{ maxLength: 255 }}
                        helperText={`${formData.title?.length || 0}/255`}
                    />
                    <TextField 
                        fullWidth 
                        margin="normal" 
                        label="Your Review" 
                        multiline 
                        rows={4} 
                        value={formData.body} 
                        onChange={e => setFormData({ ...formData, body: e.target.value })} 
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleSubmit(e);
                            }
                        }}
                        inputProps={{ maxLength: 5000 }}
                        helperText={`${formData.body?.length || 0}/5000`}
                    />
                    <Tooltip title={!formData.rating ? "Please select a rating to submit your review" : ""} placement="top">
                        <span>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                color="primary" 
                                sx={{ mt: 2 }} 
                                disabled={!formData.rating || submitting}
                            >
                                {submitting ? 'Submitting...' : 'Submit Review'}
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            )}

            {loading ? (
                <Box display="flex" justifyContent="center" py={4}><CircularProgress size={32} /></Box>
            ) : error ? (
                <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
            ) : reviews.length === 0 ? (
                <Box textAlign="center" py={4} sx={{ opacity: 0.8 }}>
                    <RateReviewIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                        {canWriteReview 
                            ? "No reviews yet. Be the first to review this product." 
                            : "No reviews yet."}
                    </Typography>
                </Box>
            ) : (
                <List sx={{ mt: 2 }}>
                    {reviews.map((r) => (
                        <React.Fragment key={r.id}>
                            <ListItem alignItems="flex-start">
                                <ListItemAvatar>
                                    <Avatar>{r.User?.firstName?.charAt(0) || 'U'}</Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                            <Typography variant="subtitle2">{r.User?.firstName || 'Anonymous'}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(r.createdAt).toLocaleDateString()}
                                            </Typography>
                                            <Rating value={r.rating} readOnly size="small" />
                                            {r.isVerifiedPurchase && (
                                                <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>✓ Verified Purchase</Typography>
                                            )}
                                        </Box>
                                    }
                                    primaryTypographyProps={{ component: 'div' }}
                                    secondary={
                                        <Box mt={1}>
                                            <Typography variant="subtitle1" fontWeight="bold">{r.title}</Typography>
                                            <Typography variant="body2" color="text.primary">{r.body}</Typography>
                                        </Box>
                                    }
                                    secondaryTypographyProps={{ component: 'div' }}
                                />
                            </ListItem>
                            <Divider component="li" />
                        </React.Fragment>
                    ))}
                </List>
            )}
            
            {hasMore && (
                <Box display="flex" justifyContent="center" mt={2}>
                    <Button 
                        variant="outlined" 
                        onClick={() => fetchReviews(page + 1)}
                        disabled={loadingMore}
                    >
                        {loadingMore ? <CircularProgress size={24} /> : 'Load More'}
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default ReviewSection;
