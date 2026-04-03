import React, { useState } from 'react';
import { Box, CardMedia, Grid } from '@mui/material';

const ProductImages = ({ images }) => {
  const sortedImages = [...(images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const primaryImage = sortedImages.find((i) => i.isPrimary) || sortedImages[0];
  const defaultImage = primaryImage?.url || '/placeholder.png';

  const [selectedImage, setSelectedImage] = useState(defaultImage);

  return (
    <Box>
      <Box
        sx={{
          width: '100%',
          pt: '100%',
          position: 'relative',
          mb: 2,
          backgroundColor: 'action.hover',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <CardMedia
          component="img"
          image={selectedImage}
          sx={{ position: 'absolute', top: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </Box>
      {sortedImages.length > 1 && (
        <Grid container spacing={1}>
          {sortedImages.map((img) => (
            <Grid item xs={3} sm={2} md={3} key={img.id}>
              <Box
                onClick={() => setSelectedImage(img.url)}
                sx={{
                  pt: '100%',
                  position: 'relative',
                  cursor: 'pointer',
                  border: selectedImage === img.url ? '2px solid' : '1px solid transparent',
                  borderColor: selectedImage === img.url ? 'primary.main' : 'transparent',
                  borderRadius: 1,
                  overflow: 'hidden',
                  backgroundColor: 'action.hover',
                }}
              >
                <CardMedia
                  component="img"
                  image={img.url}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ProductImages;
