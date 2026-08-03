import { Box, Card, CardContent, Grid, Skeleton, Stack, TableCell, TableRow } from '@mui/material';

const WIDTHS = ['72%', '58%', '86%', '45%', '66%', '78%', '52%', '90%'];
const widthAt = (row: number, col: number) => WIDTHS[(row * 3 + col * 5) % WIDTHS.length];

export function SkeletonRows({ rows = 8, columns, dense = false }: {
  rows?: number;
  columns: number;
  dense?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c} sx={dense ? { py: 0.75 } : undefined}>
              <Skeleton animation="wave" height={18} width={widthAt(r, c)} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  const bars = [58, 82, 44, 96, 70, 36, 88, 62];
  return (
    <Box sx={{ height, display: 'flex', alignItems: 'flex-end', gap: 1.5, px: 1, pb: 1 }}>
      {bars.map((h, i) => (
        <Skeleton key={i} animation="wave" variant="rounded" sx={{ flex: 1, height: `${h}%` }} />
      ))}
    </Box>
  );
}

export function DetailSkeleton() {
  const lines = (n: number) => (
    <Stack spacing={1.25}>
      {Array.from({ length: n }).map((_, i) => (
        <Stack key={i} direction="row" spacing={2} alignItems="center">
          <Skeleton animation="wave" width={90} height={16} />
          <Skeleton animation="wave" width={`${45 + ((i * 13) % 40)}%`} height={16} />
        </Stack>
      ))}
    </Stack>
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
        <Skeleton animation="wave" width={260} height={34} />
        <Skeleton animation="wave" variant="rounded" width={84} height={24} />
      </Stack>
      <Grid container spacing={2.5}>
        {[0, 1, 2].map((col) => (
          <Grid item xs={12} md={4} key={col}>
            <Stack spacing={2.5}>
              <Card>
                <CardContent>
                  <Skeleton animation="wave" width={150} height={22} sx={{ mb: 2 }} />
                  {lines(col === 0 ? 8 : 5)}
                </CardContent>
              </Card>
              {col !== 0 && (
                <Card>
                  <CardContent>
                    <Skeleton animation="wave" width={130} height={22} sx={{ mb: 2 }} />
                    {lines(3)}
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export function PageSkeleton() {
  return (
    <Box>
      <Stack sx={{ mb: 2.5 }} spacing={1}>
        <Skeleton animation="wave" width={220} height={32} />
        <Skeleton animation="wave" width={380} height={18} />
      </Stack>

      <Card>
        <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', borderBottom: 1, borderColor: 'divider' }}>
          <Skeleton animation="wave" variant="rounded" width={280} height={40} />
          <Skeleton animation="wave" variant="rounded" width={180} height={40} />
          <Box sx={{ flex: 1 }} />
          <Skeleton animation="wave" variant="rounded" width={110} height={36} />
        </Box>
        <Box sx={{ p: 2 }}>
          <Stack spacing={1.75}>
            {Array.from({ length: 9 }).map((_, i) => (
              <Stack key={i} direction="row" spacing={2}>
                {Array.from({ length: 6 }).map((__, c) => (
                  <Skeleton key={c} animation="wave" height={18} sx={{ flex: c === 0 ? 1.6 : 1 }} />
                ))}
              </Stack>
            ))}
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
