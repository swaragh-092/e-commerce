import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Rating, TextField, Divider, Avatar, List, ListItem, ListItemAvatar, ListItemText, Alert, CircularProgress } from '@mui/material';
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

    const fetchReviews = async () => {
        setLoading(true);
        try {
            const res = await reviewService.list(slug, { limit: 10 });
            setReviews(res.data || []);
        } catch (e) {
            console.error('Failed to load reviews', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [slug]);

    // Fetch user's orders to find a verified purchase orderId for this product
    useEffect(() => {
        if (!isAuthenticated || !productId) return;
        // Call backend with productId and status filter to reliably find a purchase
        // even if it's beyond the last 50 generic orders.
        orderService.getMyOrders({ productId, status: 'delivered', limit: 1 })
            .then((res) => {
                const orders = res.data || [];
                if (orders.length > 0) {
                    const order = orders[0];
                    setFormData(prev => ({ ...prev, orderId: order.id }));
                    setHasPurchased(true);
                }
            })
            .catch(() => {});
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
            setSubmitStatus({ type: 'success', message: 'Review submitted. Waiting for approval.' });
            setShowForm(false);
            fetchReviews(); // refresh reviews list
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
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Only verified purchasers can leave a review for this product.
                        </Alert>
                    ) : (
                        <Button variant="outlined" onClick={() => setShowForm(!showForm)}>
                            {showForm ? 'Cancel' : 'Write a Review'}
                        </Button>
                    )}
                </>
            ) : (
                <Typography color="text.secondary">Please login to write a review</Typography>
            )}

            {submitStatus && (
                <Alert severity={submitStatus.type} sx={{ mt: 2 }}>{submitStatus.message}</Alert>
            )}

            {showForm && (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, p: 3, border: '1px solid #ddd', borderRadius: 2 }}>
                    {formData.orderId && (
                        <Alert severity="info" sx={{ mb: 2 }}>Verified purchase found — your review will be marked as verified.</Alert>
                    )}
                    <Typography component="legend">Rating *</Typography>
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
                    />
                    <TextField 
                        fullWidth 
                        margin="normal" 
                        label="Your Review" 
                        multiline 
                        rows={4} 
                        value={formData.body} 
                        onChange={e => setFormData({ ...formData, body: e.target.value })} 
                        inputProps={{ maxLength: 5000 }}
                    />
                    <Button 
                        type="submit" 
                        variant="contained" 
                        color="primary" 
                        sx={{ mt: 2 }} 
                        disabled={!formData.rating || submitting}
                    >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                </Box>
            )}

            <List sx={{ mt: 2 }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" py={4}><CircularProgress size={32} /></Box>
                ) : reviews.length === 0 ? (
                    <Typography color="text.secondary">No reviews yet. Be the first to review this product.</Typography>
                ) : (
                    reviews.map((r) => (
                        <React.Fragment key={r.id}>
                            <ListItem alignItems="flex-start">
                                <ListItemAvatar>
                                    <Avatar>{r.User?.firstName?.charAt(0)}</Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="subtitle2">{r.User?.firstName}</Typography>
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
                    ))
                )}
            </List>
        </Box>
    );
};

export default ReviewSection;
