import React, { useMemo } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { useDesignTokens } from '../../context/ThemeContext';
import { resolveDesignTokens, resolveButtonSx } from '../../utils/designTokens';

/**
 * The single real storefront button.
 *
 * All storefront CTAs should render through this component instead of
 * hand-building MUI colours. It resolves role + appearance + interaction state
 * from the same token object that powers MUI, CSS variables, the designer
 * preview, and saved themes.
 */
const StorefrontButton = React.forwardRef(function StorefrontButton({
  role = 'primary',
  appearance,
  overImage = false,
  forcedState = null,
  loading = false,
  disabled = false,
  children,
  startIcon,
  endIcon,
  onClick,
  sx,
  ...props
}, ref) {
  const designTokens = useDesignTokens();
  const tokens = useMemo(
    () => designTokens?.tokens || resolveDesignTokens(designTokens?.themeObj || {}, null),
    [designTokens?.tokens, designTokens?.themeObj]
  );

  const isLoading = loading || forcedState === 'loading';
  const isDisabled = disabled || isLoading;
  const effectiveState = forcedState || (isLoading ? 'loading' : null);
  const resolvedAppearance = appearance || tokens.defaultAppearance[role] || 'solid';
  const stateSx = resolveButtonSx(tokens, role, resolvedAppearance, { overImage, forcedState: effectiveState });
  const extraSx = (Array.isArray(sx) ? sx : [sx]).filter(Boolean);
  const interactionSx = isDisabled && !disabled ? { pointerEvents: 'none' } : null;

  return (
    <Button
      ref={ref}
      variant="contained"
      disableElevation
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      aria-disabled={isDisabled || undefined}
      startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : startIcon}
      endIcon={endIcon}
      sx={[stateSx, interactionSx, ...extraSx]}
      data-storefront-button={role}
      data-storefront-appearance={resolvedAppearance}
      data-storefront-state={effectiveState || 'default'}
      {...props}
      onClick={(event) => {
        if (isDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </Button>
  );
});

export default StorefrontButton;
