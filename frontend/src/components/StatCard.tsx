import { Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

interface Props {
  label: string;
  value?: number | string;
  icon?: SvgIconComponent;
  color?: string;
  loading?: boolean;
  suffix?: string;
}

export default function StatCard({ label, value, icon: Icon, color = 'primary.main', loading, suffix }: Props) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {Icon && (
          <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: color, color: '#fff' }}>
            <Icon />
          </Box>
        )}
        <Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          {loading ? (
            <Skeleton width={64} height={32} />
          ) : (
            <Typography variant="h5">{value}{suffix}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
