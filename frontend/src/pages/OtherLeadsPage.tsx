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
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import {
  prettyLabel, EXTERNAL_CATEGORIES, CATEGORY_COLOR, EXHIBITOR, RECLASSIFY_OPTIONS,
} from '@/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useListExternalLeadsQuery, useExternalCountsQuery, useConvertToExhibitorMutation,
  useBulkConvertToExhibitorMutation, useReclassifyExternalLeadMutation,
  useAssignExternalLeadsMutation, useSyncExternalLeadsMutation,
  type ExternalLead, type ExternalCategory,
} from '@/features/external/externalApi';
import { useListUsersQuery } from '@/features/adminApi';

export default function OtherLeadsPage() {
  const { has, level } = usePermissions();
  const canEdit = has('lead.edit');
  const canAssign = level === 1; // only Super Admin assigns brochure leads

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [classifyTarget, setClassifyTarget] = useState<ExternalLead | null>(null);
  const [classifyCat, setClassifyCat] = useState<string>('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const { data, isFetching } = useListExternalLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    category: category || undefined,
  });
  const { data: counts } = useExternalCountsQuery();
  const { data: users } = useListUsersQuery(undefined, { skip: !canAssign });
  const [convert, { isLoading: converting }] = useConvertToExhibitorMutation();
  const [bulkConvert, { isLoading: bulkConverting }] = useBulkConvertToExhibitorMutation();
  const [reclassify, { isLoading: reclassifying }] = useReclassifyExternalLeadMutation();
  const [assignExternal, { isLoading: assigning }] = useAssignExternalLeadsMutation();
  const [syncExternal, { isLoading: syncing }] = useSyncExternalLeadsMutation();

  const members = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

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

  const doAssign = async () => {
    try {
      const res = await assignExternal({ ids: selectedIds, assignToId: assignTo }).unwrap();
      setToast({ msg: `Assigned ${res.data.assigned} lead(s)`, sev: 'success' });
      setSelected({}); setAssignTo('');
    } catch {
      setToast({ msg: 'Assignment failed', sev: 'error' });
    } finally {
      setAssignOpen(false);
    }
  };

  const doSync = async (ids: string[]) => {
    try {
      const res = await syncExternal(ids).unwrap();
      setToast({ msg: `Queued ${res.data.queued} lead(s) for sync`, sev: 'success' });
      setSelected({});
    } catch {
      setToast({ msg: 'Sync failed', sev: 'error' });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Brochure Data</Typography>
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
          {canAssign && selectedIds.length > 0 && (
            <Button size="small" variant="outlined" startIcon={<AssignmentIndIcon />} disabled={assigning} onClick={() => setAssignOpen(true)}>
              Assign ({selectedIds.length})
            </Button>
          )}
          {canEdit && selectedIds.length > 0 && (
            <Button size="small" variant="outlined" startIcon={<SyncIcon />} disabled={syncing} onClick={() => doSync(selectedIds)}>
              Sync ({selectedIds.length})
            </Button>
          )}
          {canEdit && selectedIds.length > 0 && (
            <Button size="small" variant="contained" startIcon={<SwapHorizIcon />} disabled={bulkConverting} onClick={() => setBulkConfirm(true)}>
              To exhibitor ({selectedIds.length})
            </Button>
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
                <TableCell sx={{ fontWeight: 700 }}>Assigned to</TableCell>
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
                          <Chip size="small" variant="outlined" icon={<SyncIcon />} color={r.syncStatus === 'SYNCED' ? 'success' : 'default'} label={r.syncStatus === 'SYNCED' ? 'Synced' : 'Queued'} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{r.assignedUser ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}` : '—'}</Typography>
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Reclassify this lead">
                            <Button size="small" variant="outlined" startIcon={<TuneIcon />} onClick={() => openClassify(r)}>
                              Classify
                            </Button>
                          </Tooltip>
                          <Tooltip title="Queue for sync to its panel">
                            <span>
                              <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1 }} disabled={syncing} onClick={() => doSync([r.id])}>
                                <SyncIcon fontSize="small" />
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {!isFetching && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 9 : 7} align="center" sx={{ py: 6, color: 'text.secondary' }}>No brochure leads found</TableCell>
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
          </Typography>

          <FormControl fullWidth size="small" sx={{ mt: 2.5 }}>
            <InputLabel>Reclassify as</InputLabel>
            <Select label="Reclassify as" value={classifyCat} onChange={(e) => setClassifyCat(e.target.value)}>
              {RECLASSIFY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Exhibitor moves the lead into Lead Management. Visitor, delegate & speaker stay in this panel.
          </Typography>
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

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign {selectedIds.length} brochure lead(s)</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Assign to</InputLabel>
            <Select label="Assign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
              {members.length === 0 && <MenuItem disabled>No users</MenuItem>}
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            The assigned member will see these leads in their Brochure Data and can reclassify or sync them.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!assignTo || assigning} onClick={doAssign}>Assign</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
