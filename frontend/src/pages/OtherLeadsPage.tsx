import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputAdornment, InputLabel, MenuItem, Select, Snackbar,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, Toolbar, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TuneIcon from '@mui/icons-material/Tune';
import SyncIcon from '@mui/icons-material/Sync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import {
  prettyLabel, EXTERNAL_CATEGORIES, CATEGORY_COLOR, EXHIBITOR, RECLASSIFY_OPTIONS,
} from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useListExternalLeadsQuery, useExternalCountsQuery, useConvertToExhibitorMutation,
  useBulkConvertToExhibitorMutation, useReclassifyExternalLeadMutation, useSyncExternalLeadMutation,
  useBulkSyncExternalLeadsMutation, type ExternalLead, type ExternalCategory,
} from '@/features/external/externalApi';

export default function OtherLeadsPage() {
  const { has } = usePermissions();
  const canEdit = has('lead.edit');

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [classifyTarget, setClassifyTarget] = useState<ExternalLead | null>(null);
  const [classifyCat, setClassifyCat] = useState<string>('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkSyncConfirm, setBulkSyncConfirm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const { data, isFetching } = useListExternalLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    category: category || undefined,
  });
  const { data: counts } = useExternalCountsQuery();
  const [convert, { isLoading: converting }] = useConvertToExhibitorMutation();
  const [bulkConvert, { isLoading: bulkConverting }] = useBulkConvertToExhibitorMutation();
  const [reclassify, { isLoading: reclassifying }] = useReclassifyExternalLeadMutation();
  const [syncLead, { isLoading: syncing }] = useSyncExternalLeadMutation();
  const [bulkSync, { isLoading: bulkSyncing }] = useBulkSyncExternalLeadsMutation();

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const countMap = counts?.data ?? {};
  const grandTotal = EXTERNAL_CATEGORIES.reduce((n, c) => n + (countMap[c] ?? 0), 0);
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const openClassify = (lead: ExternalLead) => {
    setClassifyTarget(lead);
    setClassifyCat(lead.category);
  };
  const clearSelection = (id: string) => setSelected((s) => { const n = { ...s }; delete n[id]; return n; });

  // Apply the chosen classification: Exhibitor moves the lead to Lead Management,
  // any other value is an in-panel category change.
  const applyClassify = async () => {
    if (!classifyTarget) return;
    const id = classifyTarget.id;
    try {
      if (classifyCat === EXHIBITOR) {
        await convert(id).unwrap();
        setToast({ msg: 'Moved to exhibitor leads (Lead Management)', sev: 'success' });
      } else if (classifyCat !== classifyTarget.category) {
        await reclassify({ id, category: classifyCat as ExternalCategory }).unwrap();
        setToast({ msg: `Reclassified as ${prettyLabel(classifyCat)}`, sev: 'success' });
      }
      clearSelection(id);
      setClassifyTarget(null);
    } catch {
      setToast({ msg: 'Update failed', sev: 'error' });
    }
  };

  // Queue for sync — the cron job pushes synced leads to their matching panel.
  const doSync = async () => {
    if (!classifyTarget) return;
    try {
      await syncLead(classifyTarget.id).unwrap();
      setToast({ msg: 'Queued for sync — the cron job will push it to its panel', sev: 'success' });
      setClassifyTarget(null);
    } catch {
      setToast({ msg: 'Sync failed', sev: 'error' });
    }
  };

  const doBulkConvert = async () => {
    try {
      const res = await bulkConvert(selectedIds).unwrap();
      setToast({ msg: `Moved ${res.data.converted} lead(s) to exhibitor leads`, sev: 'success' });
      setSelected({});
    } catch {
      setToast({ msg: 'Bulk conversion failed', sev: 'error' });
    } finally {
      setBulkConfirm(false);
    }
  };

  const doBulkSync = async () => {
    try {
      const res = await bulkSync(selectedIds).unwrap();
      setToast({ msg: `Queued ${res.data.queued} lead(s) for sync`, sev: 'success' });
      setSelected({});
    } catch {
      setToast({ msg: 'Bulk sync failed', sev: 'error' });
    } finally {
      setBulkSyncConfirm(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Other Leads</Typography>
          <Typography variant="body2" color="text.secondary">
            Visitor, delegate & speaker leads staged for the local CRM. Reclassify any as an exhibitor lead.
          </Typography>
        </Box>
      </Stack>

      <Card>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2, '& .MuiInputBase-root': { height: 40 } }}>
          <TextField
            size="small" placeholder="Search company, name, email, event…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
              <MenuItem value="">All types ({grandTotal})</MenuItem>
              {EXTERNAL_CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{prettyLabel(c)} ({countMap[c] ?? 0})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }} />
          {canEdit && selectedIds.length > 0 && (
            <>
              <Button size="small" variant="outlined" startIcon={<SyncIcon />} disabled={bulkSyncing} onClick={() => setBulkSyncConfirm(true)}>
                Sync ({selectedIds.length})
              </Button>
              <Button size="small" variant="contained" startIcon={<SwapHorizIcon />} disabled={bulkConverting} onClick={() => setBulkConfirm(true)}>
                To exhibitor ({selectedIds.length})
              </Button>
            </>
          )}
          {isFetching && <CircularProgress size={20} />}
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
            {total.toLocaleString()} total
          </Typography>
        </Toolbar>
        <Divider />

        <TableContainer>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {canEdit && (
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
                <TableCell sx={{ fontWeight: 700 }}>Designation</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                {canEdit && <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const name = r.name || [r.firstName, r.lastName].filter(Boolean).join(' ');
                return (
                  <TableRow key={r.id} hover selected={!!selected[r.id]}>
                    {canEdit && (
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
                    <TableCell><Typography variant="caption">{r.designation || '—'}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{r.eventName || '—'}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" color={CATEGORY_COLOR[r.category] ?? 'default'} label={prettyLabel(r.category)} />
                        {r.syncStatus && (
                          <Tooltip title={r.syncStatus === 'SYNCED' ? 'Sent to panel' : 'Queued — awaiting cron sync'}>
                            <Chip
                              size="small" variant="outlined"
                              color={r.syncStatus === 'SYNCED' ? 'success' : 'default'}
                              icon={r.syncStatus === 'SYNCED' ? <CloudDoneIcon /> : <SyncIcon />}
                              label={r.syncStatus === 'SYNCED' ? 'Synced' : 'Queued'}
                            />
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Tooltip title="Classify or sync this lead">
                          <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={() => openClassify(r)}>
                            Classify
                          </Button>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!isFetching && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No other leads found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

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

      <Dialog open={!!classifyTarget} onClose={() => setClassifyTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Classify lead</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {classifyTarget?.company || classifyTarget?.name
              || [classifyTarget?.firstName, classifyTarget?.lastName].filter(Boolean).join(' ') || 'This lead'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Currently {prettyLabel(classifyTarget?.category ?? '')}
            {classifyTarget?.syncStatus === 'SYNCED' && ' · already synced'}
            {classifyTarget?.syncStatus === 'PENDING' && ' · queued for sync'}
          </Typography>

          <FormControl fullWidth size="small" sx={{ mt: 2.5 }}>
            <InputLabel>Reclassify as</InputLabel>
            <Select label="Reclassify as" value={classifyCat} onChange={(e) => setClassifyCat(e.target.value)}>
              {RECLASSIFY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Exhibitor moves the lead into Lead Management. Visitor, delegate & speaker stay in this panel — use
            {' '}<b>Sync</b> to queue them so the cron job pushes them to their panel.
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Sync to panel</Typography>
              <Typography variant="caption" color="text.secondary">
                Queue for the cron job to push to the visitor / delegate / speaker panel.
              </Typography>
            </Box>
            <Button
              size="small" variant="outlined" startIcon={<SyncIcon />}
              disabled={syncing || classifyCat === EXHIBITOR || classifyTarget?.category === 'OTHER'}
              onClick={doSync}
            >
              {classifyTarget?.syncStatus ? 'Re-sync' : 'Sync'}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassifyTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={converting || reclassifying || classifyCat === classifyTarget?.category}
            onClick={applyClassify}
          >
            {classifyCat === EXHIBITOR ? 'Move to Lead Management' : 'Apply'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkConfirm} onClose={() => setBulkConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reclassify {selectedIds.length} lead(s) as exhibitor?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            The selected lead(s) will move into Lead Management as exhibitor leads (status New) and leave the Other Leads list.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkConfirm(false)}>Cancel</Button>
          <Button variant="contained" disabled={bulkConverting} onClick={doBulkConvert}>
            {bulkConverting ? 'Converting…' : `Convert ${selectedIds.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkSyncConfirm} onClose={() => setBulkSyncConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Sync {selectedIds.length} lead(s)?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            The selected lead(s) will be queued for sync. The cron job will pick them up and push each to its
            {' '}respective panel (visitor / delegate / speaker) based on its current type.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkSyncConfirm(false)}>Cancel</Button>
          <Button variant="contained" disabled={bulkSyncing} onClick={doBulkSync}>
            {bulkSyncing ? 'Queuing…' : `Sync ${selectedIds.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
