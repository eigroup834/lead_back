import { useMemo, useState } from 'react';
import {
  Box, Grid, Typography, Card, CardHeader, CardContent, Table, TableHead, TableRow, TableCell,
  TableBody, LinearProgress, Stack, Avatar, CircularProgress, Toolbar, TextField, FormControl,
  InputLabel, Select, MenuItem, Button, Divider, Chip,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ClearIcon from '@mui/icons-material/Clear';
import GroupsIcon from '@mui/icons-material/Groups';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EmojiEventsIcon2 from '@mui/icons-material/MilitaryTech';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line,
  PieChart, Pie, Cell,
} from 'recharts';
import ChartCard from '@/components/ChartCard';
import StatCard from '@/components/StatCard';
import { CHART_COLORS, MEDAL_COLORS } from '@/constants';
import {
  useDashFiltersQuery, useSummaryQuery, useFunnelQuery, useMonthlyTrendQuery,
  useTeamPerformanceQuery, type DashFilter,
} from '@/features/dashboard/dashboardApi';

export default function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');

  const filter: DashFilter = useMemo(
    () => ({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, userId: userId || undefined }),
    [dateFrom, dateTo, userId],
  );
  const hasFilter = !!(dateFrom || dateTo || userId);

  const { data: refs } = useDashFiltersQuery();
  const { data: summary, isFetching: sLoading } = useSummaryQuery(filter);
  const { data: funnel } = useFunnelQuery(filter);
  const { data: monthly } = useMonthlyTrendQuery({ ...filter, months: 12 });
  const { data: team, isLoading: teamLoading } = useTeamPerformanceQuery(filter);

  const s = summary?.data;
  const teamRows = team?.data ?? [];
  const monthlyData = (monthly?.data ?? []).map((m) => ({ ...m, label: new Date(m.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) }));
  const teamChart = teamRows.slice(0, 10).map((t) => ({ name: t.name.split(' ')[0], Assigned: t.assigned, Converted: t.converted, Calls: t.calls }));

  const clear = () => { setDateFrom(''); setDateTo(''); setUserId(''); };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Analytics</Typography>
        {hasFilter && <Chip color="primary" label="Filters applied" size="small" />}
      </Stack>

      {/* Filter bar */}
      <Card sx={{ mb: 2.5 }}>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2 }}>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} sx={{ width: 160 }} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} sx={{ width: 160 }} />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Team member</InputLabel>
            <Select label="Team member" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <MenuItem value="">All members</MenuItem>
              {[...(refs?.data.members ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
            </Select>
          </FormControl>
          {hasFilter && <Button color="inherit" size="small" startIcon={<ClearIcon />} onClick={clear}>Clear</Button>}
          <Box sx={{ flex: 1 }} />
          {sLoading && <CircularProgress size={20} />}
        </Toolbar>
      </Card>

      {/* Summary cards reflect filters */}
      <Grid container spacing={2.5} sx={{ mb: 0.5 }}>
        <Grid item xs={6} md={2.4}><StatCard label="Total" value={s?.total} icon={GroupsIcon} loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Assigned" value={s?.assigned} icon={AssignmentTurnedInIcon} color="success.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Unassigned" value={s?.unassigned} icon={HourglassEmptyIcon} color="warning.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Converted" value={s?.converted} icon={EmojiEventsIcon2} color="success.main" loading={sLoading} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard label="Conversion" value={s?.conversionRate} suffix="%" icon={TrendingUpIcon} loading={sLoading} /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {/* Team performance */}
        <Grid item xs={12} md={7}>
          <ChartCard title="Team Performance — assigned vs converted" height={340}>
            {teamLoading ? <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress /></Stack> : (
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

        {/* Leaderboard */}
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

        {/* Monthly trend */}
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

        {/* Funnel */}
        <Grid item xs={12} md={4}>
          <ChartCard title="Status Funnel" height={300}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={funnel?.data ?? []} dataKey="count" nameKey="status" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {(funnel?.data ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Detail table */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Team Performance — detail" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent sx={{ pt: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Member</TableCell>
                    <TableCell align="right">Assigned</TableCell>
                    <TableCell align="right">Calls</TableCell>
                    <TableCell align="right">Follow-ups done</TableCell>
                    <TableCell align="right">Converted</TableCell>
                    <TableCell align="right" sx={{ width: 180 }}>Conversion</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teamRows.map((t) => (
                    <TableRow key={t.userId} hover>
                      <TableCell>{t.name}</TableCell>
                      <TableCell align="right">{t.assigned}</TableCell>
                      <TableCell align="right">{t.calls}</TableCell>
                      <TableCell align="right">{t.followupsDone}</TableCell>
                      <TableCell align="right">{t.converted}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <LinearProgress variant="determinate" value={Math.min(100, t.conversionRate)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                          <Typography variant="caption" sx={{ minWidth: 36 }}>{t.conversionRate}%</Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {teamRows.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No team data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
