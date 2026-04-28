import { Paper, Box, Typography, Chip, Skeleton } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

/**
 * Metric card for the admin dashboard.
 * @param {{ title, value, icon, loading, trend, color, onClick }} props
 */
const StatCard = ({ title, value, icon, loading = false, trend, color = 'primary.main', onClick }) => (
  <Paper
    elevation={0}
    onClick={onClick}
    sx={{
      p: 3,
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      cursor: onClick ? 'pointer' : 'default',
      '&:hover': onClick ? { transform: 'translateY(-3px)', boxShadow: 6, borderColor: color } : {},
    }}
  >
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: 2,
        bgcolor: `${color}22`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
        fontSize: 28,
      }}
    >
      {icon}
    </Box>

    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {title}
      </Typography>
      {loading ? (
        <Skeleton width="60%" height={36} />
      ) : (
        <Typography variant="h5" fontWeight={700}>
          {value}
        </Typography>
      )}
      {trend != null && !loading && (
        <Chip
          size="small"
          icon={trend >= 0 ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
          label={`${trend >= 0 ? '+' : ''}${trend}%`}
          color={trend >= 0 ? 'success' : 'error'}
          sx={{ mt: 0.5, height: 20, fontSize: 11 }}
        />
      )}
    </Box>
  </Paper>
);

export default StatCard;
