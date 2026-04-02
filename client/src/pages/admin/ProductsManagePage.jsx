import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, deleteProduct } from '../../services/productService';

const ProductsManagePage = () => {
    const [products, setProducts] = useState([]);
    const navigate = useNavigate();

    const fetchProducts = async () => {
        try {
            const res = await getProducts({ limit: 100 });
            setProducts(res?.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await deleteProduct(id);
            fetchProducts();
        } catch (err) {
            alert('Failed to delete product: ' + err.message);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" gutterBottom>Manage Products</Typography>
                <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/admin/products/new">
                    Add Product
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Image</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Stock</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {products.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    <img src={row.images?.[0]?.url || '/placeholder.png'} alt={row.name} style={{ width: 50, height: 50, objectFit: 'cover' }} />
                                </TableCell>
                                <TableCell>{row.name}</TableCell>
                                <TableCell>${parseFloat(row.price).toFixed(2)}</TableCell>
                                <TableCell>{row.quantity}</TableCell>
                                <TableCell>
                                    <Chip label={row.status} color={row.status === 'published' ? 'success' : 'default'} size="small" />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => navigate(`/admin/products/${row.id}`)}><EditIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ProductsManagePage;
