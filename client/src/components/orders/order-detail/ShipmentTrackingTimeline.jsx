import { Box, Stack, Typography } from '@mui/material';
import { getShipmentTimeline, formatDateTime } from './orderDetailUtils';
import { getShipmentStatusLabel } from '../../../utils/orderWorkflow';

export default function ShipmentTrackingTimeline({ shipment, packageNumber }) {
  const events = getShipmentTimeline(shipment);
  return (
    <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Package {packageNumber} tracking history</Typography>
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No tracking updates yet.</Typography>
      ) : (
        <Stack component="ol" spacing={1.5} sx={{ m: 0, pl: 2 }}>
          {events.map((event, index) => (
            <Box component="li" key={event.id || `${event.status}-${event.at}-${index}`}>
              <Typography variant="body2" fontWeight={600}>{getShipmentStatusLabel(event.status)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {formatDateTime(event.at)} · {event.source === 'carrier' || event.source === 'webhook' ? 'Carrier update' : event.source === 'reconciliation_poll' ? 'Tracking check' : 'Staff update'}
              </Typography>
              {event.location && <Typography variant="caption" color="text.secondary">{event.location}</Typography>}
              {event.message && <Typography variant="caption" color="text.secondary" display="block">{event.message}</Typography>}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
