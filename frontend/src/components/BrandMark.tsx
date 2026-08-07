import { Box, Stack, Typography } from '@mui/material';
import { GRADIENTS } from '@/theme';

/**
 * The product lockup: mark + wordmark.
 *
 * The mark is a funnel — three rounded bars narrowing downward — which is the one
 * shape that reads instantly as "pipeline" at 32px, where a detailed illustration
 * would turn to mush. Drawn as inline SVG so it stays crisp at any density and
 * needs no image request.
 */
export function BrandGlyph({ size = 32 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        flexShrink: 0,
        background: GRADIENTS.brand,
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 2px 10px rgba(79,70,229,0.34), inset 0 1px 0 rgba(255,255,255,0.22)',
      }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="2" y="3.5" width="16" height="3" rx="1.5" fill="#fff" />
        <rect x="4.75" y="8.5" width="10.5" height="3" rx="1.5" fill="#fff" fillOpacity="0.82" />
        <rect x="7.5" y="13.5" width="5" height="3" rx="1.5" fill="#fff" fillOpacity="0.62" />
      </svg>
    </Box>
  );
}

export default function BrandMark({
  size = 32,
  showTagline = true,
  dense = false,
}: {
  size?: number;
  showTagline?: boolean;
  dense?: boolean;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
      <BrandGlyph size={size} />
      <Box sx={{ minWidth: 0, lineHeight: 1 }}>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontWeight: 750,
            fontSize: dense ? '0.9375rem' : '1.0625rem',
            letterSpacing: '-0.035em',
            whiteSpace: 'nowrap',
            lineHeight: 1.15,
          }}
        >
          Exhibitor
          <Box component="span" sx={{ color: 'primary.main', ml: 0.5 }}>CRM</Box>
        </Typography>
        {showTagline && (
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontSize: '0.5938rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              mt: 0.25,
            }}
          >
            Lead Management
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
