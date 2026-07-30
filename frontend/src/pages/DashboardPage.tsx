import { Grid, Typography, Box } from '@mui/material';
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import GroupsIcon from '@mui/icons-material/Groups';
import TodayIcon from '@mui/icons-material/Today';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import ChartCard from '@/components/ChartCard';
import {
  useSummaryQuery, useFunnelQuery, useDailyTrendQuery,
} from '@/features/dashboard/dashboardApi';
import { CHART_COLORS } from '@/constants';

export default function DashboardPage() {
  const { data: summary, isLoading } = useSummaryQuery();
  const { data: funnel } = useFunnelQuery();
  const { data: daily } = useDailyTrendQuery({ days: 30 });

  const s = summary?.data;

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Live pipeline health across every source and team." />

      <Grid container spacing={2.5} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Total Leads" value={s?.total} icon={GroupsIcon} loading={isLoading} /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Today" value={s?.today} icon={TodayIcon} color="secondary.main" loading={isLoading} /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Assigned" value={s?.assigned} icon={AssignmentTurnedInIcon} color="success.main" loading={isLoading} /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Unassigned" value={s?.unassigned} icon={HourglassEmptyIcon} color="warning.main" loading={isLoading} /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Converted" value={s?.converted} icon={EmojiEventsIcon} color="success.main" loading={isLoading} /></Grid>
        <Grid item xs={12} sm={6} md={2}><StatCard label="Conversion" value={s?.conversionRate} suffix="%" icon={TrendingUpIcon} color="primary.main" loading={isLoading} /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={7}>
          <ChartCard title="New Leads — last 30 days">
            <ResponsiveContainer>
              <LineChart data={daily?.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <ChartCard title="Lead Funnel by Status">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={funnel?.data ?? []} dataKey="count" nameKey="status" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {(funnel?.data ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
