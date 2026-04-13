import { Box, CircularProgress, Typography } from '@mui/material';

const CenteredLoader = ({ message = 'Loading...', minHeight = '40vh' }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight,
      gap: 2,
      py: 4,
    }}
  >
    <CircularProgress />
    <Typography color="text.secondary">{message}</Typography>
  </Box>
);

export default CenteredLoader;
