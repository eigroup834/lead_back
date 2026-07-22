import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputAdornment, InputLabel, MenuItem, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField,
  Toolbar, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useListHistoricalLeadsQuery, useHistoricalYearsQuery, useRestoreHistoricalLeadsMutation,
  useDeleteHistoricalLeadMutation, type HistoricalLead,
} from '@/features/historical/historicalApi';

export default function HistoricalPage() {
  const { has } = usePermissions();
  const canRestore = has('lead.create');
  const canDelete = has('lead.edit');

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [year, setYear] = useState<number | ''>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [restoreConfirm, setRestoreConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HistoricalLead | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const { data, isFetching } = useListHistoricalLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    year: year || undefined,
  });
  const { data: years } = useHistoricalYearsQuery();
  const [restore, { isLoading: restoring }] = useRestoreHistoricalLeadsMutation();
  const [remove] = useDeleteHistoricalLeadMutation();

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const yearOptions = years?.data ?? [];
  const grandTotal = yearOptions.reduce((n, y) => n + y.count, 0);
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const canSelect = canRestore;

  const doRestore = async () => {
    if (!restoreConfirm) return;
    try {
      const res = await restore(restoreConfirm.ids).unwrap();
      setToast({ msg: `Moved ${res.data.restored} lead(s) back to Lead Management`, sev: 'success' });
      setSelected({});
    } catch {
      setToast({ msg: 'Move to Lead Management failed', sev: 'error' });
    } finally {
      setRestoreConfirm(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await remove(confirmDelete.id).unwrap();
      setToast({ msg: 'Historical lead deleted', sev: 'success' });
    } catch {
      setToast({ msg: 'Delete failed', sev: 'error' });
    } finally {
      setConfirmDelete(null);
    }
  };

  const nameOf = (r: HistoricalLead) => [r.firstName, r.lastName].filter(Boolean).join(' ');

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Historical Data</Typography>
          <Typography variant="body2" color="text.secondary">
            Converted leads archived by event year. Move any back to Lead Management to work them for a new event.
          </Typography>
        </Box>
      </Stack>

      <Card>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2, '& .MuiInputBase-root': { height: 40 } }}>
          <TextField
            size="small" placeholder="Search company, name, email…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Event year</InputLabel>
            <Select label="Event year" value={year} onChange={(e) => { setYear(e.target.value === '' ? '' : Number(e.target.value)); setPage(0); }}>
              <MenuItem value="">All years ({grandTotal})</MenuItem>
              {yearOptions.map((y) => <MenuItem key={y.year} value={y.year}>{y.year} ({y.count})</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          {canRestore && selectedIds.length > 0 && (
            <Button
              size="small" variant="contained" startIcon={<ReplayIcon />} disabled={restoring}
              onClick={() => setRestoreConfirm({ ids: selectedIds, label: `${selectedIds.length} lead(s)` })}
            >
              To Lead Management ({selectedIds.length})
            </Button>
          )}
          {isFetching && <CircularProgress size={20} />}
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
            {total.toLocaleString()} total
          </Typography>
        </Toolbar>
        <Divider />

        {!isFetching && rows.length === 0 && total === 0 && !debounced && !year && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryEduIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" gutterBottom>No historical data yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Converted leads you move from Lead Management will appear here, grouped by event year.
            </Typography>
          </Box>
        )}

        {(rows.length > 0 || debounced || year) && (
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {canSelect && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedIds.length > 0 && rows.some((r) => !selected[r.id])}
                        checked={rows.length > 0 && rows.every((r) => selected[r.id])}
                        onChange={(e) => {
                          const next = { ...selected };
                          rows.forEach((r) => { next[r.id] = e.target.checked; });
                          setSelected(next);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ fontWeight: 700 }}>Company / Contact</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mobile</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Country</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Event year</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Archived</TableCell>
                  {(canRestore || canDelete) && <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => {
                  const name = nameOf(r);
                  return (
                    <TableRow key={r.id} hover selected={!!selected[r.id]}>
                      {canSelect && (
                        <TableCell padding="checkbox">
                          <Checkbox checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} />
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.company || name || '—'}</Typography>
                        {r.company && name && <Typography variant="caption" color="text.secondary">{name}</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="caption" noWrap sx={{ maxWidth: 200, display: 'block' }} title={r.email ?? ''}>{r.email || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.mobile || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.country || '—'}</Typography></TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip size="small" label={r.eventYear} />
                          {r.restoredLeadId && (
                            <Tooltip title="Already moved back to Lead Management at least once">
                              <Chip size="small" variant="outlined" color="success" label="Reused" />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell><Typography variant="caption">{new Date(r.archivedAt).toLocaleDateString()}</Typography></TableCell>
                      {(canRestore || canDelete) && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {canRestore && (
                              <Tooltip title="Move back to Lead Management">
                                <Button
                                  size="small" variant="outlined" startIcon={<ReplayIcon />}
                                  onClick={() => setRestoreConfirm({ ids: [r.id], label: `“${r.company || name || 'this lead'}”` })}
                                >
                                  To Lead Mgmt
                                </Button>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip title="Delete from Historical">
                                <span>
                                  <Button size="small" color="error" sx={{ minWidth: 0, px: 1 }} onClick={() => setConfirmDelete(r)}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </Button>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {!isFetching && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No historical leads match your filters</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          showFirstButton showLastButton
        />
      </Card>

      <Dialog open={!!restoreConfirm} onClose={() => setRestoreConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Move {restoreConfirm?.label} to Lead Management?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            A fresh lead (status New) will be created in Lead Management for each. The historical record stays here
            as your permanent archive, so you can pull the same contacts for future events too.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreConfirm(null)}>Cancel</Button>
          <Button variant="contained" disabled={restoring} onClick={doRestore}>
            {restoring ? 'Moving…' : 'Move to Lead Management'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete historical lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{confirmDelete?.company || nameOf(confirmDelete ?? {} as HistoricalLead) || 'This lead'}” will be permanently
            removed from Historical Data. Leads already moved back to Lead Management are kept.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={doDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
