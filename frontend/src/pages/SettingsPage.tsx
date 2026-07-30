import { useMemo } from 'react';
import {
  Box, Grid, Card, CardHeader, CardContent, Typography, Stack, Switch, FormControlLabel,
  Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, Divider,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleMode } from '@/features/ui/uiSlice';
import { usePermissions } from '@/hooks/usePermissions';
import { useSyncLogsQuery, useRunSyncMutation } from '@/features/adminApi';
import { sentenceCase } from '@/constants';
import { SortableCell, sortRows, useSort } from '@/components/SortableCell';
import PageHeader from '@/components/PageHeader';

type SyncLog = { startedAt: string; status: string; fetchedCount: number; insertedCount: number };
type SyncSortKey = keyof SyncLog;
const SYNC_SORT_VALUE: Record<SyncSortKey, (l: SyncLog) => string | number> = {
  startedAt: (l) => l.startedAt,
  status: (l) => l.status,
  fetchedCount: (l) => l.fetchedCount,
  insertedCount: (l) => l.insertedCount,
};

export default function SettingsPage() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.mode);
  const { user, has } = usePermissions();
  const canSync = has('lead.sync');
  const { data: logs } = useSyncLogsQuery(undefined, { skip: !canSync, pollingInterval: 10000 });
  const [runSync, { isLoading }] = useRunSyncMutation();
  const { sort, toggle: toggleSort } = useSort<SyncSortKey>({ by: 'startedAt', dir: 'desc' });
  const syncRows = useMemo(
    () => sortRows(logs?.data ?? [], sort.by, sort.dir, SYNC_SORT_VALUE),
    [logs, sort],
  );

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Your profile, appearance and lead sync." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="Profile" />
            <CardContent>
              <Row label="Name" value={`${user?.firstName} ${user?.lastName}`} />
              <Row label="Email" value={user?.email} />
              <Row label="Roles" value={user?.roles.join(', ')} />
              <Row label="Permissions" value={String(user?.permissions.length)} />
            </CardContent>
          </Card>

          <Card sx={{ mt: 2.5 }}>
            <CardHeader title="Appearance" />
            <CardContent>
              <FormControlLabel
                control={<Switch checked={mode === 'dark'} onChange={() => dispatch(toggleMode())} />}
                label="Dark mode"
              />
            </CardContent>
          </Card>
        </Grid>

        {canSync && (
          <Grid item xs={12} md={7}>
            <Card>
              <CardHeader
                title="Lead Sync"
                subheader="Pulls new records from CI website"
                action={<Button startIcon={<SyncIcon />} variant="contained" disabled={isLoading} onClick={() => runSync()}>Run now</Button>}
              />
              <Divider />
              <CardContent sx={{ pt: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableCell field="startedAt" sort={sort} onSort={toggleSort}>Started</SortableCell>
                      <SortableCell field="status" sort={sort} onSort={toggleSort}>Status</SortableCell>
                      <SortableCell field="fetchedCount" sort={sort} onSort={toggleSort} align="right">Fetched</SortableCell>
                      <SortableCell field="insertedCount" sort={sort} onSort={toggleSort} align="right">Inserted</SortableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {syncRows.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{new Date(l.startedAt).toLocaleString()}</TableCell>
                        <TableCell><Chip size="small" label={sentenceCase(l.status)} color={l.status === 'SUCCESS' ? 'success' : l.status === 'FAILED' ? 'error' : 'info'} /></TableCell>
                        <TableCell align="right">{l.fetchedCount}</TableCell>
                        <TableCell align="right">{l.insertedCount}</TableCell>
                      </TableRow>
                    ))}
                    {!logs?.data?.length && (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sync runs yet (source DB not configured)</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value || '—'}</Typography>
    </Stack>
  );
}
