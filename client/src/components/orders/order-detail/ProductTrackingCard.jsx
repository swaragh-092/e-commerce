import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import {
  formatCompactDateTime,
  formatDateOnly,
  formatDateTime,
  PRODUCT_TRACKING_STEPS,
} from './orderDetailUtils';

const ProductTrackingStepper = ({ product }) => {
  const trackingSteps = product.isCod
    ? PRODUCT_TRACKING_STEPS.filter((step) => step.key !== 'payment')
    : PRODUCT_TRACKING_STEPS;
  const currentIndex = trackingSteps.findIndex((step) => step.key === product.currentStep);
  const resolvedCurrentIndex = currentIndex >= 0 ? currentIndex : 2;

  return (
    <Box sx={{ mt: 1.75 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {trackingSteps.map((step, index) => {
          const paymentDone = step.key !== 'payment' || product.paymentSettled;
          const isTerminalProductStatus = ['delivered', 'refunded', 'partially_refunded'].includes(product.status);
          const isCompleted = step.key === 'placed' || (index < resolvedCurrentIndex && paymentDone) || (isTerminalProductStatus && paymentDone);
          const isCurrent = index === resolvedCurrentIndex && !isTerminalProductStatus;
          const isMuted = step.key === 'payment' && !product.paymentSettled;
          const dotColor = isCompleted ? 'success.main' : isCurrent ? 'primary.main' : 'transparent';
          const borderColor = isCompleted ? 'success.main' : isCurrent ? 'primary.main' : 'divider';

          return (
            <Box key={step.key} sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: dotColor,
                    border: '1px solid',
                    borderColor,
                    boxShadow: isCurrent ? '0 0 0 4px rgba(124, 92, 255, 0.12)' : 'none',
                    flexShrink: 0,
                  }}
                />
                {index < trackingSteps.length - 1 && (
                  <Box
                    sx={{
                      height: 2,
                      flex: 1,
                      mx: 0.5,
                      borderRadius: 1,
                      bgcolor: isCompleted ? 'success.main' : 'divider',
                      opacity: isCompleted ? 0.65 : 0.55,
                    }}
                  />
                )}
              </Box>
              <Typography
                noWrap
                sx={{
                  mt: 0.75,
                  pr: 0.5,
                  fontSize: '0.64rem',
                  lineHeight: 1.2,
                  fontWeight: isCurrent || isCompleted ? 700 : 500,
                  color: isMuted ? 'text.disabled' : isCurrent || isCompleted ? 'text.primary' : 'text.secondary',
                }}
              >
                {step.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

const ProductTrackingCard = ({ product, formatPrice }) => {
  const { item, segments, statusMeta } = product;
  const productLinkProps = product.productUrl
    ? { component: 'a', href: product.productUrl, target: '_blank', rel: 'noopener noreferrer' }
    : {};
  const milestones = [
    { label: 'Order placed', at: product.orderPlacedTime },
    { label: 'Payment confirmed', at: product.paymentStepTime },
    { label: 'Processing', at: product.processingTime },
  ].filter((milestone) => milestone.at);
  const hasHistory = milestones.length > 0 || segments.some((segment) => segment.history?.length || segment.expectedDeliveryHistory?.length);
  const primarySegment = segments[0];
  const totalPrice = Number(item.total ?? (Number(item.snapshotPrice || 0) * Number(item.quantity || 0)));

  return (
    <Box
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.025)',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '72px minmax(0, 1fr) auto' }, gap: 2 }}>
        <Box
          {...productLinkProps}
          sx={{
            width: 72,
            height: 72,
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: product.productUrl ? 'pointer' : 'default',
            textDecoration: 'none',
          }}
        >
          {product.imageUrl ? (
            <Box
              component="img"
              src={product.imageUrl}
              alt={item.snapshotName || 'Product'}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ReceiptLongIcon sx={{ fontSize: 26, color: 'text.disabled' }} />
          )}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography
              {...productLinkProps}
              sx={{
                fontSize: '0.98rem',
                fontWeight: 800,
                color: 'text.primary',
                textDecoration: 'none',
                cursor: product.productUrl ? 'pointer' : 'default',
                '&:hover': product.productUrl ? { color: 'primary.main' } : undefined,
              }}
            >
              {item.snapshotName}
            </Typography>
            <Chip
              size="small"
              color={statusMeta.color}
              label={statusMeta.label}
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800 }}
            />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block">
            SKU: {item.snapshotSku || '—'} · Qty {item.quantity}
          </Typography>
          {item.variantInfo && (
            <Typography variant="caption" color="text.secondary" display="block">
              {Object.entries(item.variantInfo)
                .filter(([key]) => ![
                  'id', 'productId', 'variantId', 'orderId', 'sku', 'price',
                  'isActive', 'stockQty', 'createdAt', 'updatedAt', 'deletedAt',
                  'sortOrder', 'version', 'isDefault',
                ].includes(key))
                .map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </Typography>
          )}
        </Box>

        <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {formatPrice(item.snapshotPrice || 0)} each
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 900, color: 'text.primary' }}>
            {formatPrice(totalPrice)}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: '0.72rem', color: 'text.secondary' }}>
            {product.deliveredQuantity}/{product.totalQuantity} delivered
          </Typography>
          {product.refundedAmount > 0 && (
            <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: 'success.main', fontWeight: 800 }}>
              Refunded {formatPrice(product.refundedAmount)}
            </Typography>
          )}
        </Box>
      </Box>

      <ProductTrackingStepper product={product} />

      <Box
        sx={{
          mt: 1.75,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tracking ID
          </Typography>
          {primarySegment?.trackingUrl ? (
            <Typography
              component="a"
              href={primarySegment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mt: 0.5, display: 'block', fontSize: '0.8rem', fontWeight: 800, color: 'primary.main', textDecoration: 'none' }}
            >
              {primarySegment.trackingNumber || 'Track package'}
            </Typography>
          ) : (
            <Typography sx={{ mt: 0.5, fontSize: '0.8rem', fontWeight: 800, color: primarySegment?.trackingNumber ? 'primary.main' : 'text.secondary' }}>
              {primarySegment?.trackingNumber || 'Tracking pending'}
            </Typography>
          )}
        </Box>

        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Carrier
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: '0.8rem', fontWeight: 800, color: 'text.primary' }}>
            {primarySegment?.carrier || 'Not assigned yet'}
          </Typography>
        </Box>

        <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Delivery
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: '0.8rem', fontWeight: 800, color: 'text.primary' }}>
            {product.deliveredAt
              ? `Delivered ${formatCompactDateTime(product.deliveredAt)}`
              : product.estimate
                ? `Expected ${formatDateOnly(product.estimate)}`
                : 'Estimate pending'}
          </Typography>
        </Box>
      </Box>

      {segments.length > 1 && (
        <Box sx={{ mt: 1.25, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {segments.map((segment) => (
            <Chip
              key={segment.id}
              size="small"
              variant="outlined"
              color={segment.statusColor}
              label={`Shipment #${segment.index}: Qty ${segment.quantity} · ${segment.statusLabel}`}
              sx={{ height: 22, fontSize: '0.67rem', fontWeight: 700 }}
            />
          ))}
        </Box>
      )}

      {hasHistory && (
        <Accordion
          disableGutters
          elevation={0}
          sx={{
            mt: 1.25,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'transparent',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}
            sx={{
              minHeight: 38,
              px: 1.25,
              '& .MuiAccordionSummary-content': { my: 0.75 },
            }}
          >
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 800, color: 'text.secondary' }}>
              Tracking history
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
            <Stack spacing={1}>
              {milestones.length > 0 && (
                <Box>
                  <Typography sx={{ mb: 0.5, fontSize: '0.72rem', fontWeight: 800, color: 'text.primary' }}>
                    Order milestones
                  </Typography>
                  <Stack spacing={0.6}>
                    {milestones.map((milestone) => (
                      <Box key={milestone.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatDateTime(milestone.at)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.primary' }}>
                          {milestone.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
              {segments.map((segment) => (
                <Box key={segment.id}>
                  {segments.length > 1 && (
                    <Typography sx={{ mb: 0.5, fontSize: '0.72rem', fontWeight: 800, color: 'text.primary' }}>
                      Shipment #{segment.index} · Qty {segment.quantity}
                    </Typography>
                  )}
                  <Stack spacing={0.6}>
                    {segment.expectedDeliveryHistory?.map((event, index) => (
                      <Box key={`${segment.id}-expected-${event.date}-${event.at}-${index}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatDateTime(event.at) || 'Time pending'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.primary' }}>
                          Expected {formatDateOnly(event.date)}
                        </Typography>
                      </Box>
                    ))}
                    {segment.history.map((event, index) => (
                      <Box key={`${segment.id}-${event.status}-${event.at}-${index}`} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {formatDateTime(event.at) || 'Time pending'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: 'text.primary', textTransform: 'capitalize' }}>
                          {event.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default ProductTrackingCard;
