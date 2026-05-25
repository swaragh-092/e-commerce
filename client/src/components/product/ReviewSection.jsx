import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Rating, TextField, Divider, Avatar, List, ListItem, ListItemAvatar, ListItemText, Alert, CircularProgress, Tooltip, Chip, Paper, Stack } from '@mui/material';
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
    const { isAuthenticated, user } = useAuth();
    const [submitStatus, setSubmitStatus] = useState(null);
    const [hasPurchased, setHasPurchased] = useState(false);
    const [purchaseLoading, setPurchaseLoading] = useState(false);
    const [myReview, setMyReview] = useState(null); // user's existing review (any status)
    const [myReviewLoading, setMyReviewLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [purchaseCheckError, setPurchaseCheckError] = useState(false);
    const dismissTimer = useRef(null);

    // User can write if: authenticated, no existing review (or rejected), and purchase requirement met
    const hasReviewed = myReview && myReview.status !== 'rejected';
    const canWriteReview = isAuthenticated && !hasReviewed && !purchaseLoading && (!requirePurchase || hasPurchased);

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
            if (pageNum === 1) setError('Failed to load reviews. Please try again later.');
        } finally {
            if (pageNum === 1) setLoading(false);
            else setLoadingMore(false);
        }
    };

    // Fetch user's own review via dedicated endpoint (reliable even if not on page 1)
    useEffect(() => {
        if (!isAuthenticated || !slug) return;
        setMyReviewLoading(true);
        reviewService.getMyReview(slug)
            .then((review) => setMyReview(review || null))
            .catch(() => setMyReview(null))
            .finally(() => setMyReviewLoading(false));
    }, [isAuthenticated, slug]);

    useEffect(() => {
        fetchReviews(1);
    }, [slug]);

    // Check purchase history for verified badge
    useEffect(() => {
        if (!isAuthenticated || !productId) return;
        setPurchaseCheckError(false);
        setPurchaseLoading(true);
        orderService.getMyOrders({
            productId,
            orderShippingStatus: 'delivered,partially_delivered',
            limit: 1
        })
            .then((res) => {
                const responseData = res.data || {};
                const orders = Array.isArray(responseData) ? responseData : (responseData.rows || []);
                if (orders.length > 0) {
                    setFormData(prev => ({ ...prev, orderId: orders[0].id }));
                    setHasPurchased(true);
                }
            })
            .catch(() => {
                setPurchaseCheckError(true);
                setHasPurchased(true); // allow review on error, just won't be verified
            })
            .finally(() => setPurchaseLoading(false));
    }, [isAuthenticated, productId]);

    // Auto-dismiss success message
    useEffect(() => {
        if (submitStatus?.type === 'success') {
            dismissTimer.current = setTimeout(() => setSubmitStatus(null), 5000);
        }
        return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
    }, [submitStatus]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return; // prevent double-submit

        if (!formData.title?.trim() && !formData.body?.trim()) {
            setSubmitStatus({ type: 'error', message: 'Please provide either a title or a review body.' });
            return;
        }

        setSubmitStatus(null);
        setSubmitting(true);
        try {
            await reviewService.create(slug, formData);
            setSubmitStatus({ type: 'success', message: 'Thank you! Your review has been submitted and is awaiting approval.' });
            setFormData(prev => ({ ...prev, rating: 0, title: '', body: '' }));
            setShowForm(false);
            // Refresh user's review status
            const updated = await reviewService.getMyReview(slug).catch(() => null);
            setMyReview(updated);
            fetchReviews(1);
        } catch (error) {
            const msg = error?.response?.data?.error?.message || error?.response?.data?.message || 'Review submission failed. Please try again.';
            setSubmitStatus({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    // Render user's own review card (shown at top, with status badge)
    const renderMyReview = () => {
        if (!myReview || myReviewLoading) return null;
        const statusColor = myReview.status === 'approved' ? 'success' : myReview.status === 'rejected' ? 'error' : 'warning';
        const statusLabel = myReview.status === 'approved' ? 'Approved' : myReview.status === 'rejected' ? 'Rejected' : 'Pending Approval';

        return (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, borderColor: `${statusColor}.main`, bgcolor: `${statusColor}.50` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Your Review</Typography>
                    <Chip label={statusLabel} size="small" color={statusColor} sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
                </Stack>
                <Rating value={myReview.rating} readOnly size="small" sx={{ mb: 0.5 }} />
                {myReview.title && <Typography variant="body2" fontWeight={600}>{myReview.title}</Typography>}
                {myReview.body && <Typography variant="body2" color="text.secondary">{myReview.body}</Typography>}
                {myReview.status === 'rejected' && (
                    <Alert severity="info" sx={{ mt: 1 }} variant="outlined">
                        Your review was not approved. You can submit a new one.
                    </Alert>
                )}
            </Paper>
        );
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>Customer Reviews</Typography>

            {/* User's own review at top */}
            {renderMyReview()}

            {/* Action area */}
            {isAuthenticated ? (
                <>
                    {purchaseCheckError && !hasReviewed && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            We couldn't verify your purchase history. You can still write a review, but it may not be marked as verified.
                        </Alert>
                    )}
                    {purchaseLoading && requirePurchase && !hasReviewed && (
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" color="text.secondary">Checking purchase history...</Typography>
                        </Box>
                    )}
                    {hasReviewed && myReview?.status !== 'rejected' ? null : canWriteReview ? (
                        <Button variant="outlined" onClick={() => setShowForm(!showForm)} disabled={submitting}>
                            {showForm ? 'Cancel' : myReview?.status === 'rejected' ? 'Rewrite Review' : 'Write a Review'}
                        </Button>
                    ) : requirePurchase && !hasPurchased && !purchaseLoading ? (
                        <Typography variant="body2" color="text.secondary">
                            You need to purchase and receive this product before writing a review.
                        </Typography>
                    ) : null}
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
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e);
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
                    {reviews.filter(r => !myReview || r.id !== myReview.id).map((r) => (
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
                                            {r.title && <Typography variant="subtitle1" fontWeight="bold">{r.title}</Typography>}
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
