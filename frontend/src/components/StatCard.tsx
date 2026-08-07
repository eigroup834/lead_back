import { Card, CardContent, Box, Typography, Skeleton, alpha } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

interface Props {
  label: string;
  value?: number | string;
  icon?: SvgIconComponent;
  color?: string;
  loading?: boolean;
  suffix?: string;
}

/**
 * KPI tile. The icon plate carries the colour as a soft tint rather than a solid
 * block, and a matching wash bleeds from the top-right so a row of tiles reads as
 * a set. Lifts slightly on hover, consistent with every other card.
 */
export default function StatCard({ label, value, icon: Icon, color = 'primary.main', loading, suffix }: Props) {
  return (
    <Card
      sx={(t) => {
        const key = color.split('.')[0] as 'primary' | 'success' | 'warning' | 'error' | 'info';
        const tone = (t.palette[key] as { main?: string })?.main ?? t.palette.primary.main;
        return {
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': { transform: 'translateY(-2px)' },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(120% 100% at 100% 0%, ${alpha(tone, t.palette.mode === 'dark' ? 0.16 : 0.09)} 0%, transparent 62%)`,
          },
        };
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {Icon && (
          <Box
            sx={(t) => {
              const key = color.split('.')[0] as 'primary' | 'success' | 'warning' | 'error' | 'info';
              const tone = (t.palette[key] as { main?: string })?.main ?? t.palette.primary.main;
              return {
                width: 46,
                height: 46,
                flexShrink: 0,
                borderRadius: 3,
                display: 'grid',
                placeItems: 'center',
                color: tone,
                bgcolor: alpha(tone, t.palette.mode === 'dark' ? 0.18 : 0.11),
                boxShadow: `inset 0 0 0 1px ${alpha(tone, 0.16)}`,
              };
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: '0.6875rem' }}
          >
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={72} height={34} />
          ) : (
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2, mt: 0.25 }}>
              {value}
              {suffix && (
                <Typography component="span" sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'text.secondary', ml: 0.25 }}>
                  {suffix}
                </Typography>
              )}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
