import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Rating, TextField, Divider, Avatar, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import { reviewService } from '../../services/reviewService';
import { useAuth } from '../../hooks/useAuth';

const ReviewSection = ({ slug }) => {
    const [reviews, setReviews] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ rating: 0, title: '', body: '' });
    const { isAuthenticated } = useAuth();
    const [submitStatus, setSubmitStatus] = useState(null);

    const fetchReviews = async () => {
        try {
            const res = await reviewService.list(slug, { limit: 10 });
            setReviews(res.rows || res.data || []);
        } catch (e) {
            console.error('Failed to load reviews', e);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, [slug]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitStatus(null);
        try {
            await reviewService.create(slug, formData);
            setSubmitStatus({ type: 'success', message: 'Review submitted. Waiting for approval.' });
            setShowForm(false);
        } catch (error) {
            setSubmitStatus({ type: 'error', message: error?.response?.data?.message || 'Review submission failed' });
        }
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>Customer Reviews</Typography>
            
            {isAuthenticated ? (
                <Button variant="outlined" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : 'Write a Review'}
                </Button>
            ) : (
                <Typography color="text.secondary">Please login to write a review</Typography>
            )}

            {submitStatus && <Typography color={submitStatus.type === 'error' ? 'error' : 'green'} sx={{ mt: 2 }}>{submitStatus.message}</Typography>}

            {showForm && (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, p: 3, border: '1px solid #ddd', borderRadius: 2 }}>
                    <Typography component="legend">Rating</Typography>
                    <Rating
                        name="rating"
                        value={formData.rating}
                        onChange={(event, newValue) => setFormData({ ...formData, rating: newValue })}
                        required
                    />
                    <TextField fullWidth margin="normal" label="Review Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                    <TextField fullWidth margin="normal" label="Review Body" multiline rows={4} value={formData.body} onChange={e => setFormData({ ...formData, body: e.target.value })} />
                    <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>Submit Review</Button>
                </Box>
            )}

            <List sx={{ mt: 2 }}>
                {reviews.length === 0 ? (
                    <Typography>No reviews yet.</Typography>
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
                                        </Box>
                                    }
                                    secondary={
                                        <Box mt={1}>
                                            <Typography variant="subtitle1" fontWeight="bold">{r.title}</Typography>
                                            <Typography variant="body2" color="text.primary">{r.body}</Typography>
                                            {r.isVerifiedPurchase && <Typography variant="caption" color="green">Verified Purchase</Typography>}
                                        </Box>
                                    }
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
