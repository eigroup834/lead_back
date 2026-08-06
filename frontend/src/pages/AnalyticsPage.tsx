import { useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardHeader, CardContent, Table, TableHead, TableRow, TableCell,
  TableBody, LinearProgress, Stack, Avatar, CircularProgress, Toolbar, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Divider, Chip, Alert,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ClearIcon from '@mui/icons-material/Clear';
import GroupsIcon from '@mui/icons-material/Groups';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EmojiEventsIcon2 from '@mui/icons-material/MilitaryTech';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SquareFootIcon from '@mui/icons-material/SquareFoot';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import ChartCard from '@/components/ChartCard';
import StatCard from '@/components/StatCard';
import { CHART_COLORS, MEDAL_COLORS, statusLabel, sourceChannelLabel, prettyLabel } from '@/constants';
import {
  useDashFiltersQuery, useSummaryQuery, useFunnelQuery, useMonthlyTrendQuery,
  useTeamPerformanceQuery, useConversionBySourceQuery, type DashFilter,
} from '@/features/dashboard/dashboardApi';
import type { TeamPerf } from '@/features/types';
import { SortableCell, sortRows, useSort } from '@/components/SortableCell';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/PageHeader';
import { ChartSkeleton, SkeletonRows } from '@/components/Skeletons';

type TeamSortKey = 'name' | 'assigned' | 'calls' | 'followupsDone' | 'converted' | 'conversionRate' | 'spaceBooked';
const TEAM_SORT_VALUE: Record<TeamSortKey, (t: TeamPerf) => string | number> = {
  name: (t) => t.name,
  assigned: (t) => t.assigned,
  calls: (t) => t.calls,
  followupsDone: (t) => t.followupsDone,
  converted: (t) => t.converted,
  conversionRate: (t) => t.conversionRate,
  spaceBooked: (t) => t.spaceBooked,
};

const DATE_FILTER_ENABLED = false;
// Two series, one count axis. Validated for colour-vision deficiency and for both
// light and dark surfaces; the bars carry value labels, which is also the relief the
// contrast check requires on the dark surface.
const SOURCE_COLORS = { leads: '#4f46e5', converted: '#16a34a' };

const TEAM_WIDE_LEVEL = 2;
const sqm = (n?: number) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function AnalyticsPage() {
  const { level } = usePermissions();
  const selfOnly = level > TEAM_WIDE_LEVEL;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const { sort, toggle: toggleSort } = useSort<TeamSortKey>({ by: 'converted', dir: 'desc' });

  const filter: DashFilter = useMemo(
    () => ({
      dateFrom: (DATE_FILTER_ENABLED && dateFrom) || undefined,
      dateTo: (DATE_FILTER_ENABLED && dateTo) || undefined,
      userId: userId || undefined,
    }),
    [dateFrom, dateTo, userId],
  );
  const hasFilter = !!((DATE_FILTER_ENABLED && (dateFrom || dateTo)) || userId);
  const showFilterBar = DATE_FILTER_ENABLED || !selfOnly;

  const { data: refs } = useDashFiltersQuery();
  const { data: summary, isFetching: sLoading } = useSummaryQuery(filter);
  const { data: funnel } = useFunnelQuery(filter);
  const { data: monthly } = useMonthlyTrendQuery({ ...filter, months: 12 });
  const { data: team, isLoading: teamLoading } = useTeamPerformanceQuery(filter);
  const { data: convBySource, isLoading: sourceLoading } = useConversionBySourceQuery(filter);

  const s = summary?.data;
  const teamData = team?.data ?? [];
  const teamRows = useMemo(() => sortRows(teamData, sort.by, sort.dir, TEAM_SORT_VALUE), [teamData, sort]);
  const monthlyData = (monthly?.data ?? []).map((m) => ({ ...m, label: new Date(m.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) }));
  const funnelData = (funnel?.data ?? []).map((f) => ({ ...f, status: statusLabel(f.status) }));
  const sourceData = (convBySource?.data ?? []).map((r) => ({
    name: sourceChannelLabel(r.key) || prettyLabel(r.key),
    Leads: r.total,
    Converted: r.converted,
    rate: r.conversionRate,
  }));
  const teamChart = teamData.slice(0, 10).map((t) => ({ name: t.name.split(' ')[0], Assigned: t.assigned, Converted: t.converted, Calls: t.calls }));

  const clear = () => { setDateFrom(''); setDateTo(''); setUserId(''); };

  return (
    <Box>
      <PageHeader
        title={selfOnly ? 'My Analytics' : 'Analytics'}
        subtitle={selfOnly
          ? 'Your own pipeline, conversions and space booked.'
          : 'Pipeline performance and team conversion.'}
        actions={hasFilter && <Chip color="primary" label="Filters applied" size="small" />}
      />

      {showFilterBar && (
      <Card sx={{ mb: 2.5 }}>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2 }}>
          {DATE_FILTER_ENABLED && (
            <>
              <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} sx={{ width: 160 }} />
              <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} sx={{ width: 160 }} />
            </>
          )}
          {!selfOnly && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Team member</InputLabel>
              <Select label="Team member" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <MenuItem value="">All members</MenuItem>
                {[...(refs?.data.members ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {hasFilter && <Button color="inherit" size="small" startIcon={<ClearIcon />} onClick={clear}>Clear</Button>}
          <Box sx={{ flex: 1 }} />
          {sLoading && <CircularProgress size={20} />}
        </Toolbar>
      </Card>
      )}

      <Grid container spacing={2.5} sx={{ mb: 0.5 }}>
        <Grid item xs={6} md={2.4}><StatCard label="Total" value={s?.total} icon={GroupsIcon} loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Assigned" value={s?.assigned} icon={AssignmentTurnedInIcon} color="success.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Unassigned" value={s?.unassigned} icon={HourglassEmptyIcon} color="warning.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Converted" value={s?.converted} icon={EmojiEventsIcon2} color="success.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Conversion" value={s?.conversionRate} suffix="%" icon={TrendingUpIcon} loading={sLoading} /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }} alignItems="stretch">
        <Grid item xs={12} sm={6} md={3}>
          <StatCard label="Space booked" value={sqm(s?.spaceBooked)} suffix=" sqm" icon={SquareFootIcon} color="success.main" loading={sLoading} />
        </Grid>
        {!!s?.spaceUnknown && (
          <Grid item xs={12} md={6}>
            <Alert severity="info" sx={{ height: '100%' }}>
              {s.spaceUnknown} converted lead(s) have a space value that isn&apos;t a number
              (for example &ldquo;Raw space&rdquo;), so they are not counted in the total above.
            </Alert>
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {!selfOnly && (
        <>
        <Grid item xs={12} md={7}>
          <ChartCard title="Team Performance — assigned vs converted" height={340}>
            {teamLoading ? <ChartSkeleton height={300} /> : (
              <ResponsiveContainer>
                <BarChart data={teamChart} margin={{ top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip /><Legend />
                  <Bar dataKey="Assigned" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Converted" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Calls" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardHeader title="Leaderboard" titleTypographyProps={{ variant: 'h6' }} />
            <CardContent sx={{ pt: 0 }}>
              {teamRows.slice(0, 8).map((t, i) => (
                <Box key={t.userId} sx={{ mb: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 13, bgcolor: MEDAL_COLORS[i] ?? 'grey.400', color: '#1e293b' }}>{i + 1}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" noWrap>{t.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{t.converted}/{t.assigned} · {t.conversionRate}%</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={Math.min(100, t.conversionRate)} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
                    </Box>
                  </Stack>
                </Box>
              ))}
              {teamRows.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No data</Typography>}
            </CardContent>
          </Card>
        </Grid>
        </>
        )}

        <Grid item xs={12}>
          <ChartCard title="Conversion by Source" height={320}>
            {sourceLoading ? <ChartSkeleton height={280} /> : sourceData.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No source data</Typography>
            ) : (
              <ResponsiveContainer>
                <BarChart data={sourceData} margin={{ top: 20, right: 8, bottom: 4, left: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.06 }}
                    formatter={(v: number, n: string) => [v, n]}
                    labelFormatter={(label: string) => {
                      const row = sourceData.find((d) => d.name === label);
                      return row ? `${label} — ${row.rate}% converted` : label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Leads" fill={SOURCE_COLORS.leads} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Leads" position="top" fontSize={11} />
                  </Bar>
                  <Bar dataKey="Converted" fill={SOURCE_COLORS.converted} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Converted" position="top" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <ChartCard title="Monthly Trend — leads vs conversions" height={300}>
            <ResponsiveContainer>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip /><Legend />
                <Line type="monotone" dataKey="count" name="New Leads" stroke="#4f46e5" strokeWidth={2} />
                <Line type="monotone" dataKey="converted" name="Converted" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <ChartCard title="Status Funnel" height={300}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={funnelData} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {funnelData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title={selfOnly ? 'My performance — detail' : 'Team Performance — detail'} titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent sx={{ pt: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableCell field="name" sort={sort} onSort={toggleSort}>Member</SortableCell>
                    <SortableCell field="assigned" sort={sort} onSort={toggleSort} align="right">Assigned</SortableCell>
                    <SortableCell field="calls" sort={sort} onSort={toggleSort} align="right">Calls</SortableCell>
                    <SortableCell field="followupsDone" sort={sort} onSort={toggleSort} align="right">Follow-ups done</SortableCell>
                    <SortableCell field="converted" sort={sort} onSort={toggleSort} align="right">Converted</SortableCell>
                    <SortableCell field="spaceBooked" sort={sort} onSort={toggleSort} align="right">Space booked (sqm)</SortableCell>
                    <SortableCell field="conversionRate" sort={sort} onSort={toggleSort} align="right" sx={{ width: 180 }}>Conversion</SortableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamLoading && teamRows.length === 0 && <SkeletonRows rows={6} columns={7} />}
                  {teamRows.map((t) => (
                    <TableRow key={t.userId} hover>
                      <TableCell>{t.name}</TableCell>
                      <TableCell align="right">{t.assigned}</TableCell>
                      <TableCell align="right">{t.calls}</TableCell>
                      <TableCell align="right">{t.followupsDone}</TableCell>
                      <TableCell align="right">{t.converted}</TableCell>
                      <TableCell align="right">{sqm(t.spaceBooked)}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <LinearProgress variant="determinate" value={Math.min(100, t.conversionRate)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" sx={{ minWidth: 36 }}>{t.conversionRate}%</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {teamRows.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
