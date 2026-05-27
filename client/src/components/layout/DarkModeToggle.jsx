import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useCustomerTheme } from '../../context/ThemeContext';

const DarkModeToggle = () => {
  const { isDark, toggleDarkMode } = useCustomerTheme();

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        color="inherit"
        onClick={toggleDarkMode}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default DarkModeToggle;
