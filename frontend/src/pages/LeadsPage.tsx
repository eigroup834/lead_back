import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Checkbox, Chip, IconButton, InputAdornment, Menu, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar,
  Tooltip, Typography, Select, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, TablePagination, Snackbar, Alert, Divider, CircularProgress,
  Popover, Badge, Tabs, Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import StatusChip from '@/components/StatusChip';
import RowActions, { STICKY_ACTION_COL } from '@/components/RowActions';
import PageHeader from '@/components/PageHeader';
import { SkeletonRows } from '@/components/Skeletons';
import { SortableCell, useSort } from '@/components/SortableCell';
import { useHistoricalDuplicateGuard } from '@/components/HistoricalDuplicateGuard';
import {
  LEAD_SOURCE_CHANNELS,
  prettyLabel, sourceChannelLabel, leadSourceLabel, formatDate, formatDateTime,
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
  { key: 'bookedSpace', label: 'Booked Space', sort: 'shellSpace' },
  { key: 'industry', label: 'Interest', sort: 'industry' },
  { key: 'source', label: 'Source', sort: 'sourceChannel' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'assignedUser', label: 'Assigned To', sort: 'assignedUser' },
] as const;


// Assigned Leads is worked through tab by tab, so the common statuses are one click
// away. "New" covers both NEW and ASSIGNED — leads that have not been touched yet.
const STATUS_TABS: Array<{ key: string; label: string; statuses?: string[] }> = [
  { key: 'NEW', label: 'New', statuses: ['NEW', 'ASSIGNED'] },
  { key: 'INTERESTED', label: 'Interested' },
  { key: 'NOT_REACHABLE', label: 'No Answer/Not Reachable' },
  { key: 'NOT_INTERESTED', label: 'Not Interested' },
  { key: 'INVALID', label: 'Invalid' },
  { key: 'CONVERTED', label: 'Converted' },
];

const statusesForTab = (key: string): string[] | undefined => {
  if (!key) return undefined;
  return STATUS_TABS.find((t) => t.key === key)?.statuses ?? [key];
};

// Assigned Leads always sits on a tab; New is where unworked leads live.
const DEFAULT_ASSIGNED_TAB = 'NEW';

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
  const [statusFilter, setStatusFilter] = useState(assignedOnly ? DEFAULT_ASSIGNED_TAB : '');
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
  const { sort, toggle: toggleSort } = useSort<LeadSortKey>({ by: 'createdAt', dir: 'desc' }, () => setPage(0));

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'single' | 'bulk'>(BULK_ASSIGN_ENABLED ? 'bulk' : 'single');
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveYear, setArchiveYear] = useState(new Date().getFullYear());
  const token = useAppSelector((s) => s.auth.accessToken);

  const { data, isFetching, refetch, error: listError } = useListLeadsQuery({
    page: page + 1, limit: rowsPerPage, q: debounced || undefined,
    status: assignedOnly ? statusesForTab(statusFilter) : ['NEW'],
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
  const [archiveToHistorical, { isLoading: archiving }] = useArchiveToHistoricalMutation();

  const canAssign = has('lead.assign');
  const canAssignAction = assignedOnly ? isSuperAdmin : canAssign;
  const canArchive = has('lead.edit') && !assignedOnly;
  // Row checkboxes only exist to drive bulk actions. Bulk assign is switched off and
  // the archive flow no longer uses selection, so no column is rendered.
  const canSelect = BULK_ASSIGN_ENABLED && canAssign;
  // The Converted tab is a record of what was booked: Shell Space (the enquiry) gives
  // way to Booked Space, and there is nothing left to action on a closed lead.
  const onConvertedTab = Boolean(assignedOnly) && statusFilter === 'CONVERTED';
  // Reassign is the only row action, and it is Super Admin only on Assigned Leads.
  // Tie the column to that so nobody else gets an empty Actions column.
  const showActions = canAssignAction && !onConvertedTab;
  const assignVerb = assignedOnly ? 'Reassign' : 'Assign';

  const { guard: dupGuard, checking: checkingDup, dialog: dupDialog } = useHistoricalDuplicateGuard(assignVerb);

  const leads = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const selectedConverted = useMemo(
    () => leads.filter((l) => selected[l.id] && l.status === 'CONVERTED').length,
    [leads, selected],
  );
  const visibleCols = ALL_COLUMNS.filter((c) => {
    if (hidden[c.key]) return false;
    if (c.key === 'assignedUser') return Boolean(assignedOnly);
    if (c.key === 'bookedSpace') return onConvertedTab;
    if (c.key === 'shellSpace') return !onConvertedTab;
    return true;
  });
  const assignableUsers = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const resetPaging = () => setPage(0);
  const advancedActive = [country, dateFrom, dateTo].filter(Boolean).length;
  const defaultStatus = assignedOnly ? DEFAULT_ASSIGNED_TAB : '';
  const anyActive = Boolean(sourceChannel || statusFilter !== defaultStatus || country || dateFrom || dateTo || assignee || search);
  const clearAll = () => {
    setSearch(''); setSourceChannel(''); setStatusFilter(defaultStatus); setCountry(''); setDateFrom(''); setDateTo(''); setAssignee('');
    resetPaging();
  };

  const openBulkAssign = () => { setAssignMode('bulk'); setAssignLeadId(null); setAssignOpen(true); };
  const openSingleAssign = (lead: Lead) => { setAssignMode('single'); setAssignLeadId(lead.id); setAssignOpen(true); };

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
      else statusesForTab(statusFilter)?.forEach((s) => params.append('status', s));
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
        {assignedOnly && (
          <Tabs
            value={STATUS_TABS.some((t) => t.key === statusFilter) ? statusFilter : false}
            onChange={(_e, v: string) => { setStatusFilter(v); resetPaging(); }}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            {STATUS_TABS.map((t) => <Tab key={t.key || 'all'} value={t.key} label={t.label} />)}
          </Tabs>
        )}
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

        {listError && (
          <Alert
            severity="error"
            sx={{ mx: 2, mb: 1 }}
            action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}
          >
            Could not load leads. The rows below may be from your previous view.
          </Alert>
        )}

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
                  <TableCell align="right" sx={{ ...STICKY_ACTION_COL, width: 108, pr: 2, whiteSpace: 'nowrap', zIndex: 3 }}>Actions</TableCell>
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
                    <TableCell align="right" sx={{ ...STICKY_ACTION_COL, pr: 2, whiteSpace: 'nowrap' }}>
                      <RowActions
                        actions={[
                          {
                            label: assignVerb,
                            onClick: () => openSingleAssign(l),
                            // Converted leads are closed records — no reassignment.
                            hidden: !canAssignAction || l.status === 'CONVERTED',
                          },
                        ]}
                      />
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
  const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : formatDate(d);

  return (
    <Tooltip title={`${formatDateTime(d)}${l.createDate ? '' : ' (date added)'}`}>
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
    case 'industry': return l.industry
      ? <Tooltip title={l.industry}><Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>{l.industry}</Typography></Tooltip>
      : '—';
    case 'status': return <StatusChip status={l.status} />;
    case 'bookedSpace': {
      if (!l.sqmSpace) return '—';
      const kind = l.sqmSpaceType === 'RAW' ? 'Raw' : l.sqmSpaceType === 'SHELL' ? 'Shell' : null;
      return (
        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
          {l.sqmSpace} sqm
          {kind && <Chip label={kind} size="small" variant="outlined" sx={{ ml: 0.75, height: 18 }} />}
        </Typography>
      );
    }
    case 'assignedUser': return l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : <Chip label="Unassigned" size="small" variant="outlined" />;
    case 'source': {
      const label = leadSourceLabel(l);
      return label ? <Chip label={label} size="small" variant="outlined" /> : '—';
    }
    default: return (l as unknown as Record<string, string>)[key] || '—';
  }
}
