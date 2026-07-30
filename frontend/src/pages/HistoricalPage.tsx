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
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import IconButton from '@mui/material/IconButton';
import Grid from '@mui/material/Grid';
import { usePermissions } from '@/hooks/usePermissions';
import { useDebounce } from '@/hooks/useDebounce';
import {
  useListHistoricalLeadsQuery, useRestoreHistoricalLeadsMutation, useHistoricalEventsQuery,
  useHistoricalLeadHistoryQuery, useUpdateHistoricalLeadMutation,
  type HistoricalLead, type ExhHistoryEntry,
} from '@/features/historical/historicalApi';
import { useListUsersQuery } from '@/features/adminApi';
import { SortableCell, useSort } from '@/components/SortableCell';
import PageHeader from '@/components/PageHeader';

const NO_EVENT = '__NO_EVENT__';

type HistoricalSortKey =
  | 'archivedAt' | 'eventYear' | 'company' | 'name' | 'designation' | 'email'
  | 'mobile' | 'city' | 'country' | 'remark' | 'assignedUser';

export default function HistoricalPage() {
  const { level } = usePermissions();
  const canRestore = true;
  const canEdit = true;
  const canAssign = level === 1; 

  const EDIT_FIELDS = [
    'company', 'name', 'designation', 'email', 'mobile', 'city', 'country',
    'eventName', 'eventYear', 'industry', 'branchOffice', 'remark', 'specialRemarks', 'spaceSqm',
  ] as const;
  type EditForm = Record<(typeof EDIT_FIELDS)[number], string> & { assignedUserId: string };
  const blankEdit = (): EditForm =>
    ({ ...Object.fromEntries(EDIT_FIELDS.map((k) => [k, ''])), assignedUserId: '' } as EditForm);

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [assignee, setAssignee] = useState('');
  const [eventName, setEventName] = useState('');
  const [page, setPage] = useState(0);
  const { sort, toggle: toggleSort } = useSort<HistoricalSortKey>({ by: 'eventYear', dir: 'desc' }, () => setPage(0));
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [restoreConfirm, setRestoreConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [detail, setDetail] = useState<HistoricalLead | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(blankEdit());
  const [editHistory, setEditHistory] = useState<ExhHistoryEntry[]>([]);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const { data, isFetching } = useListHistoricalLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    assigneeId: assignee || undefined,
    eventName: eventName && eventName !== NO_EVENT ? eventName : undefined,
    noEventName: eventName === NO_EVENT || undefined,
    sortBy: sort.by, sortDir: sort.dir,
  });
  const { data: events } = useHistoricalEventsQuery();
  
  const { data: users } = useListUsersQuery({ limit: 100, status: 'ACTIVE' }, { skip: !canAssign });
  const members = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const [restore, { isLoading: restoring }] = useRestoreHistoricalLeadsMutation();
  const [update, { isLoading: updating }] = useUpdateHistoricalLeadMutation();

  const rows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const anyFilter = Boolean(debounced || assignee || eventName);
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

  const openEdit = (r: HistoricalLead) => {
    setEditId(r.id);
    setEditForm({
      company: r.company ?? '', name: r.name ?? '', designation: r.designation ?? '',
      email: r.email ?? '', mobile: r.mobile ?? '', city: r.city ?? '', country: r.country ?? '',
      eventName: r.eventName ?? '', eventYear: r.eventYear != null ? String(r.eventYear) : '',
      industry: r.industry ?? '', branchOffice: r.branchOffice ?? '', remark: r.remark ?? '',
      specialRemarks: r.specialRemarks ?? '', spaceSqm: r.spaceSqm ?? '',
      assignedUserId: r.assignedUserId ?? '',
    });
    setEditHistory([...r.exhHistory].sort((a, b) => a.year - b.year));
  };
  const setEF = (k: keyof EditForm) => (e: { target: { value: string } }) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await update({
        id: editId,
        company: editForm.company || null, name: editForm.name || null, designation: editForm.designation || null,
        email: editForm.email || null, mobile: editForm.mobile || null, city: editForm.city || null,
        country: editForm.country || null, eventName: editForm.eventName || null,
        eventYear: editForm.eventYear ? Number(editForm.eventYear) : null,
        industry: editForm.industry || null, branchOffice: editForm.branchOffice || null,
        remark: editForm.remark || null, specialRemarks: editForm.specialRemarks || null,
        spaceSqm: editForm.spaceSqm || null,
        assignedUserId: canAssign ? (editForm.assignedUserId || null) : undefined,
        exhHistory: editHistory.filter((h) => h.sqm_spo.trim()).map((h) => ({ year: Number(h.year), sqm_spo: h.sqm_spo })),
      }).unwrap();
      setToast({ msg: 'Historical lead updated', sev: 'success' });
      setEditId(null);
    } catch {
      setToast({ msg: 'Update failed', sev: 'error' });
    }
  };

  const nameOf = (r: HistoricalLead) => r.name ?? '';

  return (
    <Box>
      <PageHeader
        title="Historical Data"
        subtitle="Converted leads archived by event year. Move any back to Lead Management to work them for a new event."
      />

      <Card>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2, '& .MuiInputBase-root': { height: 40 } }}>
          <TextField
            size="small" placeholder="Search company, name, email…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Event</InputLabel>
            <Select label="Event" value={eventName} onChange={(e) => { setEventName(e.target.value); setPage(0); }}>
              <MenuItem value="">All events</MenuItem>
              {(events?.data ?? []).map((e) => (
                <MenuItem key={e.event ?? NO_EVENT} value={e.event ?? NO_EVENT}>
                  {e.event ?? '(No event name)'} ({e.count})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {canAssign && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Team member</InputLabel>
              <Select label="Team member" value={assignee} onChange={(e) => { setAssignee(e.target.value); setPage(0); }}>
                <MenuItem value="">All members</MenuItem>
                {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
              </Select>
            </FormControl>
          )}
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

        {!isFetching && rows.length === 0 && total === 0 && !anyFilter && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryEduIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" gutterBottom>No historical data yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Converted leads you move from Lead Management will appear here.
            </Typography>
          </Box>
        )}

        {(rows.length > 0 || anyFilter) && (
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
                  <SortableCell field="company" sort={sort} onSort={toggleSort}>Company</SortableCell>
                  <SortableCell field="name" sort={sort} onSort={toggleSort}>Contact</SortableCell>
                  <SortableCell field="designation" sort={sort} onSort={toggleSort}>Designation</SortableCell>
                  <SortableCell field="email" sort={sort} onSort={toggleSort}>Email</SortableCell>
                  <SortableCell field="mobile" sort={sort} onSort={toggleSort}>Mobile</SortableCell>
                  <SortableCell field="city" sort={sort} onSort={toggleSort}>City</SortableCell>
                  <SortableCell field="country" sort={sort} onSort={toggleSort}>Country</SortableCell>
                  <SortableCell field="remark" sort={sort} onSort={toggleSort}>Remark</SortableCell>
                  <SortableCell field="assignedUser" sort={sort} onSort={toggleSort}>Assigned to</SortableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
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
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{r.company || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{name || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.designation || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption" noWrap sx={{ maxWidth: 180, display: 'block' }} title={r.email ?? ''}>{r.email || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.mobile || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.city || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{r.country || '—'}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap sx={{ maxWidth: 200, display: 'block' }} title={r.remark ?? ''}>{r.remark || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {r.assignedUser
                            ? <Chip size="small" color="primary" label={`${r.assignedUser.firstName} ${r.assignedUser.lastName}`} />
                            : r.assignedTo
                              ? <Tooltip title="No matching user in the system"><Chip size="small" variant="outlined" label={r.assignedTo} /></Tooltip>
                              : <Typography variant="caption" color="text.secondary">—</Typography>}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View details">
                              <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1 }} onClick={() => setDetail(r)}>
                                <VisibilityIcon fontSize="small" />
                              </Button>
                            </Tooltip>
                            {canRestore && (
                              <Tooltip title="Move back to Lead Management">
                                <Button
                                  size="small" variant="outlined" sx={{ minWidth: 0, px: 1 }}
                                  onClick={() => setRestoreConfirm({ ids: [r.id], label: `“${r.company || name || 'this lead'}”` })}
                                >
                                  <ReplayIcon fontSize="small" />
                                </Button>
                              </Tooltip>
                            )}
                            {canEdit && (
                              <Tooltip title="Edit">
                                <Button size="small" variant="outlined" sx={{ minWidth: 0, px: 1 }} onClick={() => openEdit(r)}>
                                  <EditIcon fontSize="small" />
                                </Button>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                    </TableRow>
                  );
                })}
                {!isFetching && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canSelect ? 11 : 10} align="center" sx={{ py: 6, color: 'text.secondary' }}>No historical leads match your filters</TableCell>
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

      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{detail?.company || nameOf(detail ?? {} as HistoricalLead) || 'Historical lead'}</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Stack spacing={1.5}>
              <DetailRow label="Contact" value={detail.name} />
              <DetailRow label="Designation" value={detail.designation} />
              <DetailRow label="Email" value={detail.email} />
              <DetailRow label="Mobile" value={detail.mobile} />
              <DetailRow label="Event" value={detail.eventName} />
              <DetailRow label="Industry" value={detail.industry} />
              <DetailRow label="City" value={detail.city} />
              <DetailRow label="Country" value={detail.country} />
              <DetailRow label="Assigned to" value={detail.assignedUser ? `${detail.assignedUser.firstName} ${detail.assignedUser.lastName}` : detail.assignedTo} />
              <DetailRow label="Remark" value={detail.remark} />
              <DetailRow label="Special remarks" value={detail.specialRemarks} />
              <Divider />
              <Typography variant="subtitle2">Participation history (Sqm / Spo)</Typography>
              {detail.exhHistory.length ? (
                <Table size="small">
                  <TableHead>
                    <TableRow><TableCell sx={{ fontWeight: 700 }}>Year</TableCell><TableCell sx={{ fontWeight: 700 }}>Sqm / Spo</TableCell></TableRow>
                  </TableHead>
                  <TableBody>
                    {[...detail.exhHistory].sort((a, b) => a.year - b.year).map((h) => (
                      <TableRow key={h.year}><TableCell>{h.year}</TableCell><TableCell>{h.sqm_spo}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <Typography variant="body2" color="text.secondary">No participation history</Typography>}
              <Divider />
              <Typography variant="subtitle2">Edit history</Typography>
              <EditHistory leadId={detail.id} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!restoreConfirm} onClose={() => setRestoreConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Move {restoreConfirm?.label} to Lead Management?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            A fresh lead is created in Lead Management for each, assigned to the same member it was assigned to
            (so it appears in their Assigned Leads). Ones with no matching member move in unassigned. The historical
            record stays here as your permanent archive.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreConfirm(null)}>Cancel</Button>
          <Button variant="contained" disabled={restoring} onClick={doRestore}>
            {restoring ? 'Moving…' : 'Move to Lead Management'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editId} onClose={() => setEditId(null)} maxWidth="md" fullWidth>
        <DialogTitle>Edit historical lead</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Company" value={editForm.company} onChange={setEF('company')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Contact name" value={editForm.name} onChange={setEF('name')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Designation" value={editForm.designation} onChange={setEF('designation')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Email" value={editForm.email} onChange={setEF('email')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Mobile" value={editForm.mobile} onChange={setEF('mobile')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Event name" value={editForm.eventName} onChange={setEF('eventName')} /></Grid>
            <Grid item xs={6} sm={3}><TextField size="small" fullWidth label="Event year" type="number" value={editForm.eventYear} onChange={setEF('eventYear')} /></Grid>
            <Grid item xs={6} sm={3}><TextField size="small" fullWidth label="Industry" value={editForm.industry} onChange={setEF('industry')} /></Grid>
            <Grid item xs={6} sm={3}><TextField size="small" fullWidth label="City" value={editForm.city} onChange={setEF('city')} /></Grid>
            <Grid item xs={6} sm={3}><TextField size="small" fullWidth label="Country" value={editForm.country} onChange={setEF('country')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Branch office" value={editForm.branchOffice} onChange={setEF('branchOffice')} /></Grid>
            <Grid item xs={12} sm={6}><TextField size="small" fullWidth label="Space (sqm)" value={editForm.spaceSqm} onChange={setEF('spaceSqm')} /></Grid>
            {canAssign && (
              <Grid item xs={12} sm={6}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Assigned to</InputLabel>
                  <Select label="Assigned to" value={editForm.assignedUserId} onChange={(e) => setEditForm((f) => ({ ...f, assignedUserId: e.target.value }))}>
                    <MenuItem value=""><em>Unassigned</em></MenuItem>
                    {members.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12}><TextField size="small" fullWidth multiline minRows={2} label="Remark" value={editForm.remark} onChange={setEF('remark')} /></Grid>
            <Grid item xs={12}><TextField size="small" fullWidth multiline minRows={2} label="Special remarks" value={editForm.specialRemarks} onChange={setEF('specialRemarks')} /></Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Participation history (Year · Sqm / Spo)</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={() => setEditHistory((h) => [...h, { year: new Date().getFullYear(), sqm_spo: '' }])}>
              Add year
            </Button>
          </Stack>
          <Stack spacing={1}>
            {editHistory.map((h, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <TextField size="small" type="number" label="Year" sx={{ width: 120 }}
                  value={h.year}
                  onChange={(e) => setEditHistory((arr) => arr.map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)))}
                />
                <TextField size="small" fullWidth label="Sqm / Spo"
                  value={h.sqm_spo}
                  onChange={(e) => setEditHistory((arr) => arr.map((x, j) => (j === i ? { ...x, sqm_spo: e.target.value } : x)))}
                />
                <IconButton size="small" onClick={() => setEditHistory((arr) => arr.filter((_, j) => j !== i))}><CloseIcon fontSize="small" /></IconButton>
              </Stack>
            ))}
            {editHistory.length === 0 && <Typography variant="body2" color="text.secondary">No participation history — use “Add year”.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditId(null)}>Cancel</Button>
          <Button variant="contained" disabled={updating} onClick={saveEdit}>{updating ? 'Saving…' : 'Save changes'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function EditHistory({ leadId }: { leadId: string }) {
  const { data, isFetching } = useHistoricalLeadHistoryQuery(leadId);
  const edits = data?.data ?? [];

  if (isFetching && !data) return <CircularProgress size={18} />;
  if (!edits.length) return <Typography variant="body2" color="text.secondary">No edits recorded yet</Typography>;

  return (
    <Stack spacing={1.5}>
      {edits.map((e) => (
        <Box key={e.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {e.editedBy ? `${e.editedBy.firstName} ${e.editedBy.lastName}` : 'Unknown user'}
            {' · '}
            {new Date(e.createdAt).toLocaleString()}
          </Typography>
          {e.changes.map((c) => (
            <Typography key={c.field} variant="body2" sx={{ display: 'block' }}>
              <Box component="span" sx={{ fontWeight: 600 }}>{c.label}: </Box>
              <Box component="span" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>{c.from ?? '—'}</Box>
              {' → '}
              <Box component="span">{c.to ?? '—'}</Box>
            </Typography>
          ))}
        </Box>
      ))}
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</Typography>
    </Stack>
  );
}
