import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, Checkbox, Chip, IconButton, InputAdornment, Menu, MenuItem, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar,
  Tooltip, Typography, Select, FormControl, InputLabel, OutlinedInput, ListItemText, Dialog,
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
import {
  LEAD_STATUSES, LEAD_SOURCE_CHANNELS, EXTERNAL_LEAD_TYPES, ASSIGNABLE_ROLE_LEVELS,
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
  { key: 'company', label: 'Company' },
  { key: 'name', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'country', label: 'Country' },
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'assignedUser', label: 'Assigned To' },
] as const;

export default function LeadsPage({ assignedOnly }: { assignedOnly?: boolean }) {
  const navigate = useNavigate();
  const { has, user } = usePermissions();

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [status, setStatus] = useState<string[]>([]);
  const [sourceChannel, setSourceChannel] = useState('');
  const [country, setCountry] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assignee, setAssignee] = useState('');
  const [page, setPage] = useState(0); // MUI is 0-based
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [colAnchor, setColAnchor] = useState<null | HTMLElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; lead: Lead } | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'single' | 'bulk'>('bulk');
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
    status: status.length ? status : undefined,
    sourceChannel: sourceChannel || undefined,
    country: country || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    // Assigned Leads page → only leads that have an assignee; assignee dropdown narrows further.
    assigned: assignedOnly || undefined,
    assignedUserId: assignee || undefined,
    sortBy: 'createdAt', sortDir: 'desc',
  });
  const { data: users } = useListUsersQuery(undefined, { skip: !has('lead.assign') });
  const { data: refFilters } = useDashFiltersQuery(undefined, { skip: !has('dashboard.view') });

  const [assignBulk, { isLoading: bulkLoading }] = useAssignBulkMutation();
  const [assignSingle, { isLoading: singleLoading }] = useAssignSingleMutation();
  const [convertExternal, { isLoading: convertLoading }] = useConvertExternalMutation();
  const [archiveToHistorical, { isLoading: archiving }] = useArchiveToHistoricalMutation();

  const canAssign = has('lead.assign');
  const canEdit = has('lead.edit');
  // Archiving converted leads into Historical. Only meaningful on the main pipeline.
  const canArchive = has('lead.edit') && !assignedOnly;
  const canSelect = canAssign || canArchive; // whether the checkbox column renders
  const showActions = canAssign || canEdit; // whether the row kebab column renders

  const leads = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  // Of the current selection, how many are eligible (Converted) to archive.
  const selectedConverted = useMemo(
    () => leads.filter((l) => selected[l.id] && l.status === 'CONVERTED').length,
    [leads, selected],
  );
  const visibleCols = ALL_COLUMNS.filter((c) => !hidden[c.key]);
  const assignableUsers = (users?.data ?? []).filter((u) => u.roles.some((r) => ASSIGNABLE_ROLE_LEVELS.includes(r.role.level)));

  const resetPaging = () => setPage(0);

  // Filters split: search + status + source stay inline; the rest live behind the
  // "Filters" button. Badge shows how many of those advanced filters are active.
  const advancedActive = [country, dateFrom, dateTo].filter(Boolean).length;
  const anyActive = Boolean(status.length || sourceChannel || country || dateFrom || dateTo || assignee || search);
  const clearAll = () => {
    setSearch(''); setStatus([]); setSourceChannel(''); setCountry(''); setDateFrom(''); setDateTo(''); setAssignee('');
    resetPaging();
  };

  const openBulkAssign = () => { setAssignMode('bulk'); setAssignLeadId(null); setAssignOpen(true); };
  const openSingleAssign = (lead: Lead) => { setAssignMode('single'); setAssignLeadId(lead.id); setAssignOpen(true); setRowMenu(null); };

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
      status.forEach((s) => params.append('status', s));
      if (sourceChannel) params.set('sourceChannel', sourceChannel);
      if (country) params.set('country', country);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (assignedOnly) params.set('assigned', 'true');
      if (assignee) params.set('assignedUserId', assignee);
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{assignedOnly ? 'Assigned Leads' : 'Lead Management'}</Typography>
        <Stack direction="row" spacing={1}>
          {has('lead.assign') && selectedIds.length > 0 && (
            <Button startIcon={<AssignmentIndIcon />} variant="contained" onClick={openBulkAssign}>
              Assign ({selectedIds.length})
            </Button>
          )}
          {canArchive && selectedConverted > 0 && (
            <Tooltip title="Archive converted leads to Historical Data">
              <Button startIcon={<Inventory2Icon />} variant="outlined" disabled={archiving} onClick={() => setArchiveOpen(true)}>
                Move to Historical ({selectedConverted})
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Columns"><IconButton onClick={(e) => setColAnchor(e.currentTarget)}><ViewColumnIcon /></IconButton></Tooltip>
          <Tooltip title="Refresh"><IconButton onClick={() => refetch()}><RefreshIcon /></IconButton></Tooltip>
        </Stack>
      </Stack>

      <Card>
        <Toolbar sx={{ gap: 1.5, flexWrap: 'wrap', py: 2, '& .MuiInputBase-root': { height: 40 } }}>
          {/* Primary filters (inline) */}
          <TextField
            size="small" placeholder="Search company, email, name, mobile…"
            value={search} onChange={(e) => { setSearch(e.target.value); resetPaging(); }}
            sx={{ minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Status</InputLabel>
            <Select
              multiple value={status} input={<OutlinedInput label="Status" />}
              onChange={(e) => { setStatus(typeof e.target.value === 'string' ? [e.target.value] : e.target.value); resetPaging(); }}
              renderValue={(sel) => (sel as string[]).map(sentenceCase).join(', ')}
            >
              {LEAD_STATUSES.map((st) => (
                <MenuItem key={st} value={st}>
                  <Checkbox checked={status.includes(st)} size="small" />
                  <ListItemText primary={sentenceCase(st)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel>Source</InputLabel>
            <Select label="Source" value={sourceChannel} onChange={(e) => { setSourceChannel(e.target.value); resetPaging(); }}>
              <MenuItem value="">All sources</MenuItem>
              {LEAD_SOURCE_CHANNELS.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          {has('lead.assign') && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Assignee</InputLabel>
              <Select label="Assignee" value={assignee} onChange={(e) => { setAssignee(e.target.value); resetPaging(); }}>
                <MenuItem value="">Anyone</MenuItem>
                {assignableUsers.map((u) => <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Right side: status + actions */}
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
          {has('lead.export') && (
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

        {/* Advanced filters popover */}
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
                {visibleCols.map((c) => <TableCell key={c.key} sx={{ fontWeight: 700 }}>{c.label}</TableCell>)}
                {showActions && <TableCell padding="checkbox" />}
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
                    <TableCell key={c.key} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/leads/${l.id}`)}>
                      {renderCell(c.key, l)}
                    </TableCell>
                  ))}
                  {showActions && (
                    <TableCell padding="checkbox">
                      <IconButton size="small" onClick={(e) => setRowMenu({ el: e.currentTarget, lead: l })}><MoreVertIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
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

      {/* row action menu */}
      <Menu anchorEl={rowMenu?.el} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        <MenuItem onClick={() => rowMenu && navigate(`/leads/${rowMenu.lead.id}`)}>Open details</MenuItem>
        {canAssign && <MenuItem onClick={() => rowMenu && openSingleAssign(rowMenu.lead)}>Assign…</MenuItem>}
        {canEdit && <Divider />}
        {canEdit && <MenuItem disabled sx={{ opacity: 1, fontSize: 12, color: 'text.secondary' }}>Convert to external lead</MenuItem>}
        {canEdit && EXTERNAL_LEAD_TYPES.map((t) => (
          <MenuItem
            key={t}
            onClick={() => { if (rowMenu) setConvertTarget({ lead: rowMenu.lead, type: t }); setRowMenu(null); }}
          >
            {prettyLabel(t)}
          </MenuItem>
        ))}
      </Menu>

      {/* convert-to-external confirm dialog */}
      <Dialog open={!!convertTarget} onClose={() => setConvertTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Convert to {convertTarget ? prettyLabel(convertTarget.type) : ''} lead?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            “{convertTarget?.lead.company || [convertTarget?.lead.firstName, convertTarget?.lead.lastName].filter(Boolean).join(' ') || 'This lead'}”
            {' '}will be moved out of the exhibitor pipeline into the external ({prettyLabel(convertTarget?.type ?? 'VISITOR')}) list for the local CRM.
            It will no longer appear in Lead Management.
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
                setToast({ msg: `Moved to ${prettyLabel(convertTarget.type)} (external) list`, sev: 'success' });
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

      {/* move-to-historical (archive) dialog */}
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

      {/* column visibility */}
      <Menu anchorEl={colAnchor} open={!!colAnchor} onClose={() => setColAnchor(null)}>
        {ALL_COLUMNS.map((c) => (
          <MenuItem key={c.key} onClick={() => setHidden((h) => ({ ...h, [c.key]: !h[c.key] }))}>
            <Checkbox checked={!hidden[c.key]} size="small" /> {c.label}
          </MenuItem>
        ))}
      </Menu>

      {/* assign dialog (single or bulk) */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{assignMode === 'single' ? 'Assign lead' : `Assign ${selectedIds.length} lead(s)`}</DialogTitle>
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
          <Button variant="contained" disabled={!assignTo || bulkLoading || singleLoading} onClick={doAssign}>Assign</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}

function renderCell(key: string, l: Lead) {
  switch (key) {
    case 'name': return [l.firstName, l.lastName].filter(Boolean).join(' ') || '—';
    case 'status': return <StatusChip status={l.status} />;
    case 'assignedUser': return l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName}` : <Chip label="Unassigned" size="small" variant="outlined" />;
    case 'source': {
      const label = l.sourceChannel ? sourceChannelLabel(l.sourceChannel) : (l.source ? prettyLabel(l.source) : '');
      return label ? <Chip label={label} size="small" variant="outlined" /> : '—';
    }
    default: return (l as unknown as Record<string, string>)[key] || '—';
  }
}
