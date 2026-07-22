import { Card, CardContent, CardHeader } from '@mui/material';
import type { ReactNode } from 'react';

export default function ChartCard({ title, children, height = 300 }: { title: string; children: ReactNode; height?: number }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader title={title} titleTypographyProps={{ variant: 'h6' }} />
      <CardContent sx={{ height }}>{children}</CardContent>
    </Card>
  );
}
