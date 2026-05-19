import { Box } from '@mui/material';

const TabPanel = ({ children, value, index, idPrefix, sx = {}, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    {...(idPrefix ? { id: `${idPrefix}-tabpanel-${index}`, 'aria-labelledby': `${idPrefix}-tab-${index}` } : {})}
    {...other}
  >
    {value === index && <Box sx={sx}>{children}</Box>}
  </div>
);

export default TabPanel;
