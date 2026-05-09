import { Box, Paper, Stack, Typography } from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SectionLabel from './SectionLabel';
import ProductTrackingCard from './ProductTrackingCard';
import { sxCard } from './styles';

const ProductTrackingSection = ({ products, deliveredProducts, formatPrice }) => (
  <Paper elevation={0} sx={{ ...sxCard, mb: 2.5 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <SectionLabel icon={ReceiptLongIcon}>Product tracking</SectionLabel>
      <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
        {deliveredProducts} of {products.length} delivered
      </Typography>
    </Box>

    <Stack spacing={1.5}>
      {products.map((product) => (
        <ProductTrackingCard
          key={product.item.id}
          product={product}
          formatPrice={formatPrice}
        />
      ))}
    </Stack>
  </Paper>
);

export default ProductTrackingSection;
