import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { getCategoryTree, createCategory, updateCategory, deleteCategory } from '../../services/categoryService';

const CategoriesPage = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingCat, setEditingCat] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', parentId: '' });

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const res = await getCategoryTree();
            setCategories(res?.data?.categories || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleOpen = (cat = null) => {
        setEditingCat(cat);
        setFormData(cat ? { name: cat.name, description: cat.description || '', parentId: cat.parentId || '' } : { name: '', description: '', parentId: '' });
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingCat(null);
    };

    const handleSave = async () => {
        try {
            const data = { ...formData };
            if (!data.parentId) data.parentId = null; 
            
            if (editingCat) {
                await updateCategory(editingCat.id, data);
            } else {
                await createCategory(data);
            }
            handleClose();
            fetchCategories();
        } catch (err) {
            alert(err?.response?.data?.error?.message || err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete category?')) return;
        try {
            await deleteCategory(id);
            fetchCategories();
        } catch (err) {
            alert('Cannot delete: ' + (err?.response?.data?.error?.message || err.message));
        }
    };

    const renderTree = (nodes, level = 0) => {
        return nodes.map((node) => (
            <Box key={node.id} sx={{ ml: level * 4, display: 'flex', alignItems: 'center', py: 1, borderBottom: '1px solid #eee' }}>
                <Typography sx={{ flexGrow: 1, pl: level > 0 ? 1 : 0, fontWeight: level === 0 ? 'bold' : 'normal' }}>
                    {level > 0 ? '↳ ' : ''}{node.name}
                </Typography>
                <IconButton size="small" onClick={() => handleOpen(node)}><EditIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => handleDelete(node.id)}><DeleteIcon fontSize="small" /></IconButton>
                {node.children && renderTree(node.children, level + 1)}
            </Box>
        ));
    };

    const flatCategories = [];
    const flatten = (nodes) => {
        nodes.forEach(n => {
            flatCategories.push(n);
            if (n.children?.length) flatten(n.children);
        });
    };
    flatten(categories);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" gutterBottom>Manage Categories</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>Add Category</Button>
            </Box>
            
            <Paper sx={{ p: 2 }}>
                {loading ? <CircularProgress /> : renderTree(categories)}
            </Paper>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>{editingCat ? 'Edit Category' : 'New Category'}</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Name" fullWidth value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    <TextField margin="dense" label="Description" fullWidth multiline rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                    <TextField
                        select
                        margin="dense"
                        label="Parent Category"
                        fullWidth
                        value={formData.parentId}
                        onChange={e => setFormData({...formData, parentId: e.target.value})}
                        SelectProps={{ native: true }}
                    >
                        <option value="">None (Top Level)</option>
                        {flatCategories.filter(c => c.id !== editingCat?.id).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}>Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CategoriesPage;
