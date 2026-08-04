import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Checkbox, Chip, IconButton, InputAdornment, Menu, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar,
  Tooltip, Typography, Select, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, TablePagination, Snackbar, Alert, Divider, CircularProgress,
  Popover, Badge,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import StatusChip from '@/components/StatusChip';
import PageHeader from '@/components/PageHeader';
import { SkeletonRows } from '@/components/Skeletons';
import { SortableCell, useSort } from '@/components/SortableCell';
import { useHistoricalDuplicateGuard } from '@/components/HistoricalDuplicateGuard';
import {
  LEAD_SOURCE_CHANNELS, LEAD_DETAIL_STATUS_OPTIONS, EXTERNAL_LEAD_TYPES,
  prettyLabel, sentenceCase, sourceChannelLabel, type ExternalLeadType,
} from '@/constants';
import { useAppSelector } from '@/store';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useListLeadsQuery, useAssignBulkMutation, useAssignSingleMutation,
  useConvertExternalMutation, useArchiveToHistoricalMutation,
} from '@/features/leads/leadsApi';
import { useListUsersQuery } from '@/features/adminApi';
import { useDashFiltersQuery } from '@/features/dashboard/dashboardApi';
import type { Lead } from '@/features/types';
import ClearIcon from '@mui/icons-material/Clear';

const ALL_COLUMNS = [
  { key: 'date', label: 'Lead Date', sort: 'createdAt' },
  { key: 'company', label: 'Company', sort: 'company' },
  { key: 'name', label: 'Contact', sort: 'firstName' },
  { key: 'email', label: 'Email', sort: 'email' },
  { key: 'mobile', label: 'Mobile', sort: 'mobile' },
  { key: 'country', label: 'Country', sort: 'country' },
  { key: 'shellSpace', label: 'Shell Space', sort: 'shellSpace' },
  { key: 'remarks', label: 'Interest', sort: 'remarks' },
  { key: 'source', label: 'Source', sort: 'sourceChannel' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'assignedUser', label: 'Assigned To', sort: 'assignedUser' },
] as const;

const BULK_ASSIGN_ENABLED = false;
const EXCEL_EXPORT_ENABLED = false;

type LeadSortKey = (typeof ALL_COLUMNS)[number]['sort'] | 'createdAt';

export default function LeadsPage({ assignedOnly }: { assignedOnly?: boolean }) {
  const navigate = useNavigate();
  const { has, user, level } = usePermissions();
  const isSuperAdmin = level === 1;
  const canFilterByMember = Boolean(assignedOnly) && level < 4 && has('user.view');

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [sourceChannel, setSourceChannel] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [country, setCountry] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assignee, setAssignee] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [colAnchor, setColAnchor] = useState<null | HTMLElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; lead: Lead } | null>(null);
  const { sort, toggle: toggleSort } = useSort<LeadSortKey>({ by: 'createdAt', dir: 'desc' }, () => setPage(0));

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'single' | 'bulk'>(BULK_ASSIGN_ENABLED ? 'bulk' : 'single');
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [convertTarget, setConvertTarget] = useState<{ lead: Lead; type: ExternalLeadType } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear());
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data, isFetching, refetch } = useListLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    status: assignedOnly ? (statusFilter ? [statusFilter] : undefined) : ['NEW'],
    sourceChannel: sourceChannel && sourceChannel !== 'HISTORICAL' ? sourceChannel : undefined,
    source: sourceChannel === 'HISTORICAL' ? 'HISTORICAL' : undefined,
    country: country || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    assigned: assignedOnly || undefined,
    assignedUserId: assignee || undefined,
    sortBy: sort.by, sortDir: sort.dir,
  }, { refetchOnMountOrArgChange: true });
  
  const { data: users } = useListUsersQuery({ limit: 100, status: 'ACTIVE' }, { skip: !has('lead.assign') && !canFilterByMember });
  const { data: refFilters } = useDashFiltersQuery(undefined, { skip: !has('dashboard.view') });

  const [assignBulk, { isLoading: bulkLoading }] = useAssignBulkMutation();
  const [assignSingle, { isLoading: singleLoading }] = useAssignSingleMutation();
  const [convertExternal, { isLoading: convertLoading }] = useConvertExternalMutation();
  const [archiveToHistorical, { isLoading: archiving }] = useArchiveToHistoricalMutation();

  const canAssign = has('lead.assign');
  const canAssignAction = assignedOnly ? isSuperAdmin : canAssign;
  const canEdit = has('lead.edit');
  const canArchive = has('lead.edit') && !assignedOnly;
  const canSelect = (BULK_ASSIGN_ENABLED && canAssign) || canArchive;
  const showActions = canAssign || canEdit;
  const assignVerb = assignedOnly ? 'Reassign' : 'Assign';

  const { guard: dupGuard, checking: checkingDup, dialog: dupDialog } = useHistoricalDuplicateGuard(assignVerb);

  const leads = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedConverted = useMemo(
    () => leads.filter((l) => selected[l.id] && l.status === 'CONVERTED').length,
    [leads, selected],
  );
  const visibleCols = ALL_COLUMNS.filter(
    (c) => !hidden[c.key] && (assignedOnly || c.key !== 'assignedUser'),
  );
  const assignableUsers = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const resetPaging = () => setPage(0);
  const advancedActive = [country, dateFrom, dateTo].filter(Boolean).length;
  const anyActive = Boolean(sourceChannel || statusFilter || country || dateFrom || dateTo || assignee || search);
  const clearAll = () => {
    setSearch(''); setSourceChannel(''); setStatusFilter(''); setCountry(''); setDateFrom(''); setDateTo(''); setAssignee('');
    resetPaging();
  };

  const openBulkAssign = () => { setAssignMode('bulk'); setAssignLeadId(null); setAssignOpen(true); };
  const openSingleAssign = (lead: Lead) => { setAssignMode('single'); setAssignLeadId(lead.id); setAssignOpen(true); setRowMenu(null); };

  const confirmThenAssign = async () => {
    const ids = assignMode === 'single' && assignLeadId ? [assignLeadId] : selectedIds;
    await dupGuard(ids, doAssign);
  };

  const doAssign = async () => {
    try {
      if (assignMode === 'single' && assignLeadId) {
        await assignSingle({ leadId: assignLeadId, assignToId: assignTo }).unwrap();
        setToast({ msg: 'Lead assigned', sev: 'success' });
      } else {
        await assignBulk({ leadIds: selectedIds, assignToId: assignTo }).unwrap();
        setToast({ msg: `${selectedIds.length} lead(s) assigned`, sev: 'success' });
        setSelected({});
      }
      setAssignOpen(false); setAssignTo('');
    } catch {
      setToast({ msg: 'Assignment failed', sev: 'error' });
    }
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set('q', debounced);
      if (!assignedOnly) params.append('status', 'NEW');
      else if (statusFilter) params.append('status', statusFilter);
      if (sourceChannel === 'HISTORICAL') params.set('source', 'HISTORICAL');
      else if (sourceChannel) params.set('sourceChannel', sourceChannel);
      if (country) params.set('country', country);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (assignedOnly) params.set('assigned', 'true');
      if (assignee) params.set('assignedUserId', assignee);
      params.set('sortBy', sort.by);
      params.set('sortDir', sort.dir);
      const res = await fetch(`/api/v1/leads/export?${params.toString()}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ msg: 'Export failed', sev: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const doArchive = async () => {
    try {
      const res = await archiveToHistorical({ leadIds: selectedIds, eventYear: archiveYear }).unwrap();
      const skipped = res.data.skipped ? `, ${res.data.skipped} skipped (not converted)` : '';
      setToast({ msg: `Archived ${res.data.archived} lead(s) to Historical ${archiveYear}${skipped}`, sev: 'success' });
      setSelected({});
    } catch {
      setToast({ msg: 'Archive failed', sev: 'error' });
    } finally {
      setArchiveOpen(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={assignedOnly ? 'Assigned Leads' : 'Lead Management'}
        subtitle={assignedOnly
          ? 'Leads assigned to your team — open one to log activity and follow-ups.'
          : 'New leads from the website and manual entry, ready to be assigned.'}
        actions={(
          <>
            {BULK_ASSIGN_ENABLED && canAssignAction && selectedIds.length > 0 && (
              <Button startIcon={<AssignmentIndIcon />} variant="contained" onClick={openBulkAssign}>
                {assignVerb} ({selectedIds.length})
              </Button>
            )}
            {canArchive && selectedConverted > 0 && (
              <Tooltip title="Archive converted leads to Historical Data">
                <Button startIcon={<Inventory2Icon />} variant="outlined" disabled={archiving} onClick={() => setArchiveOpen(true)}>
                  Move to Historical ({selectedConverted})
                </Button>
              </Tooltip>
            )}
            <Tooltip title="Columns"><IconButton onClick={(e) => setColAnchor(e.currentTarget)}><ViewColumnIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Refresh"><IconButton onClick={() => refetch()}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
          </>
        )}
      />

      <Card>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2, '& .MuiInputBase-root': { height: 40 } }}>
          <TextField
            size="small" placeholder="Search company, email, name, mobile…"
            value={search} onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
            sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Source</InputLabel>
            <Select label="Source" value={sourceChannel} onChange={(e) => { setSourceChannel(e.target.value); resetPaging(); }}>
              <MenuItem value="">All sources</MenuItem>
              {LEAD_SOURCE_CHANNELS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              <MenuItem value="HISTORICAL">Historical</MenuItem>
            </Select>
          </FormControl>
          {assignedOnly && (
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPaging(); }}>
                <MenuItem value="">All statuses</MenuItem>
                {LEAD_DETAIL_STATUS_OPTIONS.map((st) => <MenuItem key={st} value={st}>{sentenceCase(st)}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          {canFilterByMember && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Team member</InputLabel>
              <Select label="Team member" value={assignee} onChange={(e) => { setAssignee(e.target.value); resetPaging(); }}>
                <MenuItem value="">All members</MenuItem>
                {assignableUsers.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>
                ))}
                {assignableUsers.length === 0 && <MenuItem disabled>No users found</MenuItem>}
              </Select>
            </FormControl>
          )}

          <Box sx={{ flex: 1 }} />

          {isFetching && <CircularProgress size={20} />}
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
            {total.toLocaleString()} total
          </Typography>
          {anyActive && (
            <Button size="small" color="inherit" startIcon={<ClearIcon />} onClick={clearAll}>Clear</Button>
          )}
          <Badge badgeContent={advancedActive} color="primary">
            <Button variant="outlined" size="small" startIcon={<FilterListIcon />} onClick={(e) => setFilterAnchor(e.currentTarget)}>
              Filters
            </Button>
          </Badge>
          {EXCEL_EXPORT_ENABLED && has('lead.export') && (
            <Tooltip title="Download leads as Excel">
              <span>
                <IconButton onClick={downloadExcel} disabled={downloading}>
                  {downloading ? <CircularProgress size={20} /> : <DownloadIcon />}
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Toolbar>
        <Divider />

        <Popover
          open={!!filterAnchor}
          anchorEl={filterAnchor}
          onClose={() => setFilterAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2, width: 300 }}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" color="text.secondary">More filters</Typography>
              <FormControl size="small" fullWidth>
                <InputLabel>Country</InputLabel>
                <Select label="Country" value={country} onChange={(e) => { setCountry(e.target.value); resetPaging(); }}>
                  <MenuItem value="">All countries</MenuItem>
                  {(refFilters?.data.countries ?? []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} fullWidth value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPaging(); }} />
                <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} fullWidth value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPaging(); }} />
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Button size="small" color="inherit" startIcon={<ClearIcon />} onClick={clearAll}>Clear all</Button>
                <Button size="small" variant="contained" onClick={() => setFilterAnchor(null)}>Done</Button>
              </Stack>
            </Stack>
          </Box>
        </Popover>

        <TableContainer>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {canSelect && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedIds.length > 0 && selectedIds.length < leads.length}
                      checked={leads.length > 0 && leads.every((l) => selected[l.id])}
                      onChange={(e) => {
                        const next = { ...selected };
                        leads.forEach((l) => { next[l.id] = e.target.checked; });
                        setSelected(next);
                      }}
                    />
                  </TableCell>
                )}
                {visibleCols.map((c) => (
                  <SortableCell key={c.key} field={c.sort} sort={sort} onSort={toggleSort}>{c.label}</SortableCell>
                ))}
                {showActions && (
                  <TableCell align="right" sx={{ width: 108, pr: 2, whiteSpace: 'nowrap' }}>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {leads.map((l: Lead) => (
                <TableRow key={l.id} hover selected={!!selected[l.id]}>
                  {canSelect && (
                    <TableCell padding="checkbox">
                      <Checkbox checked={!!selected[l.id]} onChange={(e) => setSelected((s) => ({ ...s, [l.id]: e.target.checked }))} />
                    </TableCell>
                  )}
                  {visibleCols.map((c) => (
                    <TableCell
                      key={c.key}
                      sx={assignedOnly ? { cursor: 'pointer' } : undefined}
                      onClick={assignedOnly ? () => navigate(`/leads/${l.id}`) : undefined}
                    >
                      {renderCell(c.key, l)}
                    </TableCell>
                  ))}
                  {showActions && (
                    <TableCell align="right" sx={{ pr: 2, whiteSpace: 'nowrap' }}>
                      {assignedOnly ? (
                        <IconButton size="small" onClick={(e) => setRowMenu({ el: e.currentTarget, lead: l })}><MoreVertIcon fontSize="small" /></IconButton>
                      ) : canAssignAction && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openSingleAssign(l)}
                          sx={{
                            minHeight: 28,
                            minWidth: 72,
                            px: 1.5,
                            fontSize: '0.75rem',
                            lineHeight: 1.6,
                            borderColor: 'divider',
                            color: 'primary.main',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          Assign
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {isFetching && leads.length === 0 && (
                <SkeletonRows rows={rowsPerPage > 10 ? 10 : rowsPerPage} columns={visibleCols.length + (canSelect ? 1 : 0) + (showActions ? 1 : 0)} />
              )}
              {!isFetching && leads.length === 0 && (
                <TableRow><TableCell colSpan={visibleCols.length + (canSelect ? 1 : 0) + (showActions ? 1 : 0)} align="center" sx={{ py: 6, color: 'text.secondary' }}>No leads found</TableCell></TableRow>
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

      <Menu anchorEl={rowMenu?.el} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        {assignedOnly && <MenuItem onClick={() => rowMenu && navigate(`/leads/${rowMenu.lead.id}`)}>Open details</MenuItem>}
        {canAssignAction && <MenuItem onClick={() => rowMenu && openSingleAssign(rowMenu.lead)}>{assignVerb}…</MenuItem>}
        {assignedOnly && canEdit && <Divider />}
        {assignedOnly && canEdit && <MenuItem disabled sx={{ opacity: 1, fontSize: 12, color: 'text.secondary' }}>Convert to external lead</MenuItem>}
        {assignedOnly && canEdit && EXTERNAL_LEAD_TYPES.map((t) => (
          <MenuItem
            key={t}
            onClick={() => { if (rowMenu) setConvertTarget({ lead: rowMenu.lead, type: t }); setRowMenu(null); }}
          >
            {prettyLabel(t)}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={!!convertTarget} onClose={() => setConvertTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Convert to {convertTarget ? prettyLabel(convertTarget.type) : ''} lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{convertTarget?.lead.company || [convertTarget?.lead.firstName, convertTarget?.lead.lastName].filter(Boolean).join(' ') || 'This lead'}”
            {' '}will be moved out of the exhibitor pipeline and queued straight for sync to the
            {' '}{prettyLabel(convertTarget?.type ?? 'VISITOR')} panel. It will no longer appear in Lead Management,
            and it skips Brochure Data because it is already queued.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertTarget(null)}>Cancel</Button>
          <Button
            variant="contained" disabled={convertLoading}
            onClick={async () => {
              if (!convertTarget) return;
              try {
                await convertExternal({ id: convertTarget.lead.id, type: convertTarget.type }).unwrap();
                setToast({ msg: `Queued for sync to the ${prettyLabel(convertTarget.type)} panel`, sev: 'success' });
              } catch {
                setToast({ msg: 'Conversion failed', sev: 'error' });
              } finally {
                setConvertTarget(null);
              }
            }}
          >
            Convert
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={archiveOpen} onClose={() => setArchiveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Move {selectedConverted} converted lead(s) to Historical?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            These converted leads will be archived under the event year below and removed from Lead Management.
            You can move any of them back to Lead Management from the Historical Data tab for a future event.
          </Typography>
          <TextField
            type="number" label="Event year" size="small" fullWidth
            value={archiveYear}
            onChange={(e) => setArchiveYear(Number(e.target.value))}
            inputProps={{ min: 2000, max: 2100 }}
            helperText="The event these leads belong to (e.g. this year’s show)."
          />
          {selectedIds.length > selectedConverted && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {selectedIds.length - selectedConverted} of the {selectedIds.length} selected are not Converted and will be skipped.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={archiving || !archiveYear} onClick={doArchive}>
            {archiving ? 'Moving…' : `Move ${selectedConverted} to Historical`}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
        {ALL_COLUMNS.map((c) => (
          <MenuItem key={c.key} onClick={() => setHidden((h) => ({ ...h, [c.key]: !h[c.key] }))}>
            <Checkbox checked={!hidden[c.key]} size="small" /> {c.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{assignMode === 'single' ? `${assignVerb} lead` : `${assignVerb} ${selectedIds.length} lead(s)`}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Assign to</InputLabel>
            <Select label="Assign to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              {assignableUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.roles[0]?.role.label}</MenuItem>
              ))}
              {assignableUsers.length === 0 && <MenuItem disabled>No assignable users</MenuItem>}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!assignTo || bulkLoading || singleLoading || checkingDup}
            onClick={confirmThenAssign}
          >
            {checkingDup ? 'Checking…' : assignVerb}
          </Button>
        </DialogActions>
      </Dialog>

      {dupDialog}

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function leadDateCell(l: Lead) {
  const iso = l.createDate ?? l.createdAt;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : d.toLocaleDateString();

  return (
    <Tooltip title={`${d.toLocaleString()}${l.createDate ? '' : ' (date added)'}`}>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: days === 0 ? 700 : 400 }} color={days === 0 ? 'primary.main' : 'inherit'}>
        {label}
      </Typography>
    </Tooltip>
  );
}

function renderCell(key: string, l: Lead) {
  switch (key) {
    case 'date': return leadDateCell(l);
    case 'name': return [l.firstName, l.lastName].filter(Boolean).join(' ') || '—';
    case 'remarks': return l.remarks
      ? <Tooltip title={l.remarks}><Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{l.remarks}</Typography></Tooltip>
      : '—';
    case 'status': return <StatusChip status={l.status} />;
    case 'assignedUser': return l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : <Chip label="Unassigned" size="small" variant="outlined" />;
    case 'source': {
      const label = l.sourceChannel ? sourceChannelLabel(l.sourceChannel) : (l.source ? prettyLabel(l.source) : '');
      return label ? <Chip label={label} size="small" variant="outlined" /> : '—';
    }
    default: return (l as unknown as Record<string, string>)[key] || '—';
  }
}
