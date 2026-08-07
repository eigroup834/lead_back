import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputLabel, Menu, MenuItem, Select, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar, Tooltip,
  Typography,
} from '@mui/material';
import StatusChip from '@/components/StatusChip';
import {
  LEAD_STATUSES, FOLLOWUP_SCOPES, PRIORITIES, PRIORITY_COLOR,
  sentenceCase, statusLabel, leadSourceLabel, formatDate, formatDateTime,
} from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useListFollowupsQuery, useFollowupCountsQuery, useUpdateFollowupMutation, useListUsersQuery,
  type FollowupRow, type FollowupLead,
} from '@/features/adminApi';
import { useChangeStatusMutation } from '@/features/leads/leadsApi';
import { SortableCell, sortRows, useSort } from '@/components/SortableCell';
import PageHeader from '@/components/PageHeader';
import RowActions, { STICKY_ACTION_COL } from '@/components/RowActions';
import { SkeletonRows } from '@/components/Skeletons';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isOverdue = (iso: string) => new Date(iso) < startOfToday();

type FollowupSortKey =
  | 'leadDate' | 'company' | 'contact' | 'email' | 'mobile' | 'country' | 'shellSpace'
  | 'industry' | 'source' | 'status' | 'assignee' | 'followupDate' | 'priority' | 'note';

const rank = (list: readonly string[], v?: string) => {
  const i = list.indexOf(v ?? '');
  return i === -1 ? list.length : i;
};

const SORT_VALUE: Record<FollowupSortKey, (f: FollowupRow) => string | number> = {
  leadDate: (f) => f.lead?.createDate ?? f.lead?.createdAt ?? '',
  company: (f) => f.lead?.company || '',
  contact: (f) => [f.lead?.firstName, f.lead?.lastName].filter(Boolean).join(' '),
  email: (f) => f.lead?.email || '',
  mobile: (f) => f.lead?.mobile || '',
  country: (f) => f.lead?.country || '',
  shellSpace: (f) => f.lead?.shellSpace || '',
  industry: (f) => f.lead?.industry || '',
  source: (f) => f.lead?.sourceChannel || f.lead?.source || '',
  status: (f) => rank(LEAD_STATUSES, f.lead?.status),
  assignee: (f) => (f.lead?.assignedUser
    ? `${f.lead.assignedUser.firstName} ${f.lead.assignedUser.lastName}`
    : f.assignee ? `${f.assignee.firstName} ${f.assignee.lastName}` : ''),
  followupDate: (f) => `${f.followupDate}T${f.followupTime ?? ''}`,
  priority: (f) => rank(PRIORITIES, f.priority),
  note: (f) => f.note || '',
};

const COLUMN_COUNT = 15;

function leadDateCell(lead?: FollowupLead) {
  const iso = lead?.createDate ?? lead?.createdAt;
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const startOfDayMs = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDayMs(new Date()) - startOfDayMs(d)) / 86_400_000);
  const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : formatDate(d);

  return (
    <Tooltip title={`${formatDateTime(d)}${lead?.createDate ? '' : ' (date added)'}`}>
      <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: days === 0 ? 700 : 400 }} color={days === 0 ? 'primary.main' : 'inherit'}>
        {label}
      </Typography>
    </Tooltip>
  );
}

function sourceCell(lead?: FollowupLead) {
  const label = lead ? leadSourceLabel(lead) : '';
  return label ? <Chip label={label} size="small" variant="outlined" /> : '—';
}

export default function FollowupsPage() {
  const navigate = useNavigate();
  const { level } = usePermissions();
  const isManager = level < 4;

  const [scope, setScope] = useState('today');
  const [assigneeId, setAssigneeId] = useState('');
  const { sort, toggle: toggleSort } = useSort<FollowupSortKey>({ by: 'followupDate', dir: 'asc' });
  const { data, isFetching } = useListFollowupsQuery(
    { scope, assigneeId: assigneeId || undefined },
    { refetchOnMountOrArgChange: true },
  );
  const { data: countsData } = useFollowupCountsQuery(
    { assigneeId: assigneeId || undefined },
    { refetchOnMountOrArgChange: true },
  );
  const { data: users } = useListUsersQuery({ limit: 100, status: 'ACTIVE' }, { skip: !isManager });

  const [update] = useUpdateFollowupMutation();
  const [changeStatus] = useChangeStatusMutation();

  const [statusMenu, setStatusMenu] = useState<{ el: HTMLElement; row: FollowupRow } | null>(null);
  const [reschedule, setReschedule] = useState<{ row: FollowupRow; date: string; time: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const rows = useMemo(() => sortRows(data?.data ?? [], sort.by, sort.dir, SORT_VALUE), [data, sort]);
  const assignableUsers = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const counts: Record<string, number> = countsData?.data ?? { overdue: 0, today: 0, upcoming: 0, all: 0 };

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const nowD = new Date();
  const todayStr = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`;
  const nowTimeStr = `${pad2(nowD.getHours())}:${pad2(nowD.getMinutes())}`;
  const reTimeInvalid = reschedule?.date === todayStr && !!reschedule?.time && reschedule.time < nowTimeStr;

  const doReschedule = async () => {
    if (!reschedule?.date) return;
    try {
      await update({
        id: reschedule.row.id, followupDate: reschedule.date,
        followupTime: reschedule.time || undefined, status: 'PENDING',
      }).unwrap();
      setToast({ msg: 'Follow-up rescheduled', sev: 'success' });
      setReschedule(null);
    } catch { setToast({ msg: 'Could not reschedule', sev: 'error' }); }
  };

  const applyLeadStatus = async (row: FollowupRow, status: string) => {
    if (!row.lead) return;
    try {
      await changeStatus({ id: row.lead.id, status }).unwrap();
      setToast({ msg: `Lead marked ${statusLabel(status)}`, sev: 'success' });
    } catch { setToast({ msg: 'Could not change lead status', sev: 'error' }); }
    setStatusMenu(null);
  };

  return (
    <Box>
      <PageHeader
        title="Follow-ups"
        subtitle={`Track and action your scheduled follow-ups${isManager ? ' across the team' : ''}.`}
        actions={isManager && (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Team member</InputLabel>
            <Select label="Team member" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <MenuItem value="">All members</MenuItem>
              {assignableUsers.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.firstName} {u.lastName}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />

      <Card>
        <Toolbar sx={{ px: 2, gap: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1} sx={{ flex: 1, flexWrap: 'wrap' }}>
            {FOLLOWUP_SCOPES.map((s) => (
              <Button
                key={s.key}
                size="small"
                variant={scope === s.key ? 'contained' : 'text'}
                color={s.key === 'overdue' ? 'error' : 'primary'}
                onClick={() => setScope(s.key)}
                sx={{ borderRadius: 5 }}
              >
                {s.label}
                <Chip
                  size="small"
                  color={s.key === 'overdue' ? 'error' : scope === s.key ? 'default' : 'primary'}
                  label={counts[s.key] ?? 0}
                  sx={{ ml: 0.75, height: 18, '& .MuiChip-label': { px: 0.75 } }}
                />
              </Button>
            ))}
          </Stack>
          {isFetching && <CircularProgress size={20} />}
          <Typography variant="body2" color="text.secondary">{rows.length} follow-up(s)</Typography>
        </Toolbar>

        <TableContainer>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <SortableCell field="leadDate" sort={sort} onSort={toggleSort}>Lead Date</SortableCell>
                <SortableCell field="company" sort={sort} onSort={toggleSort}>Company</SortableCell>
                <SortableCell field="contact" sort={sort} onSort={toggleSort}>Contact</SortableCell>
                <SortableCell field="email" sort={sort} onSort={toggleSort}>Email</SortableCell>
                <SortableCell field="mobile" sort={sort} onSort={toggleSort}>Mobile</SortableCell>
                <SortableCell field="country" sort={sort} onSort={toggleSort}>Country</SortableCell>
                <SortableCell field="shellSpace" sort={sort} onSort={toggleSort}>Shell Space</SortableCell>
                <SortableCell field="industry" sort={sort} onSort={toggleSort}>Interest</SortableCell>
                <SortableCell field="source" sort={sort} onSort={toggleSort}>Source</SortableCell>
                <SortableCell field="status" sort={sort} onSort={toggleSort}>Status</SortableCell>
                <SortableCell field="assignee" sort={sort} onSort={toggleSort}>Assigned To</SortableCell>
                <SortableCell field="followupDate" sort={sort} onSort={toggleSort}>Follow-up</SortableCell>
                <SortableCell field="priority" sort={sort} onSort={toggleSort}>Priority</SortableCell>
                <SortableCell field="note" sort={sort} onSort={toggleSort}>Remark</SortableCell>
                <TableCell align="right" sx={{ ...STICKY_ACTION_COL, fontWeight: 700, pr: 2, zIndex: 3 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isFetching && rows.length === 0 && (
                <SkeletonRows rows={8} columns={COLUMN_COUNT} />
              )}
              {rows.map((f) => {
                const lead = f.lead;
                const overdue = isOverdue(f.followupDate);
                const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ');
                // The whole row opens the lead; cells with their own control stop the bubble.
                const open = () => { if (lead) navigate(`/leads/${lead.id}`); };
                const cell = { cursor: lead ? 'pointer' : 'default' };
                return (
                  <TableRow key={f.id} hover>
                    <TableCell sx={cell} onClick={open}>{leadDateCell(lead)}</TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{lead?.company || '—'}</Typography>
                      {lead?.designation && (
                        <Typography variant="caption" color="text.secondary">{lead.designation}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={cell} onClick={open}><Typography variant="body2">{name || '—'}</Typography></TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Typography variant="caption" noWrap sx={{ display: 'block', maxWidth: 190 }} title={lead?.email ?? ''}>
                        {lead?.email || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cell} onClick={open}><Typography variant="caption">{lead?.mobile || '—'}</Typography></TableCell>
                    <TableCell sx={cell} onClick={open}><Typography variant="caption">{lead?.country || '—'}</Typography></TableCell>
                    <TableCell sx={cell} onClick={open}><Typography variant="caption">{lead?.shellSpace || '—'}</Typography></TableCell>
                    <TableCell sx={cell} onClick={open}>
                      {lead?.industry
                        ? <Tooltip title={lead.industry}><Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>{lead.industry}</Typography></Tooltip>
                        : '—'}
                    </TableCell>
                    <TableCell sx={cell} onClick={open}>{sourceCell(lead)}</TableCell>
                    <TableCell>
                      {lead?.status === 'CONVERTED' ? (
                        <Tooltip title="Converted leads are closed and cannot change status">
                          <Box component="span"><StatusChip status={lead.status as never} /></Box>
                        </Tooltip>
                      ) : (
                        <Tooltip title="Click to change lead status">
                          <Box
                            component="span"
                            sx={{ cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setStatusMenu({ el: e.currentTarget, row: f }); }}
                          >
                            {lead ? <StatusChip status={lead.status as never} /> : '—'}
                          </Box>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Typography variant="caption">
                        {lead?.assignedUser
                          ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}`
                          : f.assignee ? `${f.assignee.firstName} ${f.assignee.lastName}` : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Typography variant="body2" color={overdue ? 'error.main' : 'text.primary'} sx={{ fontWeight: overdue ? 700 : 400, whiteSpace: 'nowrap' }}>
                        {formatDate(f.followupDate)} {f.followupTime ?? ''}
                      </Typography>
                      {overdue && <Typography variant="caption" color="error.main">Overdue</Typography>}
                    </TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Chip size="small" label={sentenceCase(f.priority)} color={PRIORITY_COLOR[f.priority] ?? 'default'} />
                    </TableCell>
                    <TableCell sx={cell} onClick={open}>
                      <Typography variant="caption" sx={{ display: 'block', maxWidth: 200 }} title={f.note ?? ''} noWrap>{f.note || '—'}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ ...STICKY_ACTION_COL, pr: 2 }}>
                      <RowActions
                        actions={[
                          {
                            label: 'Reschedule',
                            onClick: () => setReschedule({ row: f, date: f.followupDate.slice(0, 10), time: f.followupTime ?? '' }),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isFetching && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No follow-ups in this view
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Menu anchorEl={statusMenu?.el} open={!!statusMenu} onClose={() => setStatusMenu(null)}>
        {LEAD_STATUSES.map((s) => (
          <MenuItem
            key={s}
            selected={statusMenu?.row.lead?.status === s}
            onClick={() => statusMenu && applyLeadStatus(statusMenu.row, s)}
          >
            {statusLabel(s)}
          </MenuItem>
        ))}
      </Menu>


      <Dialog open={!!reschedule} onClose={() => setReschedule(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reschedule follow-up</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField
              type="date" fullWidth label="New follow-up date" InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayStr }}
              value={reschedule?.date ?? ''} onChange={(e) => setReschedule((r) => (r ? { ...r, date: e.target.value } : r))}
            />
            <TextField
              type="time" fullWidth label="Time (IST)" InputLabelProps={{ shrink: true }}
              inputProps={{ min: reschedule?.date === todayStr ? nowTimeStr : undefined }}
              value={reschedule?.time ?? ''} onChange={(e) => setReschedule((r) => (r ? { ...r, time: e.target.value } : r))}
              error={reTimeInvalid}
              helperText={reTimeInvalid ? 'Time is in the past' : 'SMS reminder is sent to the assignee'}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReschedule(null)}>Cancel</Button>
          <Button variant="contained" disabled={!reschedule?.date || reTimeInvalid} onClick={doReschedule}>Reschedule</Button>
        </DialogActions>
      </Dialog>

      <Divider />
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {toast ? <Alert severity={toast.sev} onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
