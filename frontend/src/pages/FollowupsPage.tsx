import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, InputLabel, Menu, MenuItem, Select, Snackbar, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Toolbar, Tooltip,
  Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import StatusChip from '@/components/StatusChip';
import { LEAD_STATUSES, FOLLOWUP_SCOPES, PRIORITY_COLOR, sentenceCase } from '@/constants';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useListFollowupsQuery, useFollowupCountsQuery, useUpdateFollowupMutation, useListUsersQuery, type FollowupRow,
} from '@/features/adminApi';
import { useChangeStatusMutation } from '@/features/leads/leadsApi';

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const isOverdue = (iso: string) => new Date(iso) < startOfToday();

export default function FollowupsPage() {
  const navigate = useNavigate();
  const { level } = usePermissions();
  const isManager = level < 4; // levels 1-3 can view teammates' follow-ups

  const [scope, setScope] = useState('today');
  const [assigneeId, setAssigneeId] = useState('');
  const { data, isFetching } = useListFollowupsQuery({ scope, assigneeId: assigneeId || undefined });
  const { data: countsData } = useFollowupCountsQuery({ assigneeId: assigneeId || undefined });
  const { data: users } = useListUsersQuery(undefined, { skip: !isManager });

  const [update] = useUpdateFollowupMutation();
  const [changeStatus] = useChangeStatusMutation();

  const [statusMenu, setStatusMenu] = useState<{ el: HTMLElement; row: FollowupRow } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; row: FollowupRow } | null>(null);
  const [reschedule, setReschedule] = useState<{ row: FollowupRow; date: string; time: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const rows = data?.data ?? [];
  const assignableUsers = [...(users?.data ?? [])]
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const counts: Record<string, number> = countsData?.data ?? { overdue: 0, today: 0, upcoming: 0, all: 0 };

  // Reschedule may be today or later; if today, time can't be earlier than now.
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const nowD = new Date();
  const todayStr = `${nowD.getFullYear()}-${pad2(nowD.getMonth() + 1)}-${pad2(nowD.getDate())}`;
  const nowTimeStr = `${pad2(nowD.getHours())}:${pad2(nowD.getMinutes())}`;
  const reTimeInvalid = reschedule?.date === todayStr && !!reschedule?.time && reschedule.time < nowTimeStr;

  const markDone = async (row: FollowupRow) => {
    try { await update({ id: row.id, status: 'DONE' }).unwrap(); setToast({ msg: 'Follow-up marked done', sev: 'success' }); }
    catch { setToast({ msg: 'Could not update follow-up', sev: 'error' }); }
    setRowMenu(null);
  };

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
      setToast({ msg: `Lead marked ${sentenceCase(status)}`, sev: 'success' });
    } catch { setToast({ msg: 'Could not change lead status', sev: 'error' }); }
    setStatusMenu(null);
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Box>
          <Typography variant="h5">Follow-ups</Typography>
          <Typography variant="body2" color="text.secondary">
            Track and action your scheduled follow-ups{isManager ? ' across the team' : ''}.
          </Typography>
        </Box>
        {isManager && (
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
      </Stack>

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
                <TableCell sx={{ fontWeight: 700 }}>Company / Contact</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reach</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Lead status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Follow-up</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                {isManager && <TableCell sx={{ fontWeight: 700 }}>Assignee</TableCell>}
                <TableCell sx={{ fontWeight: 700 }}>Note</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((f) => {
                const lead = f.lead;
                const overdue = isOverdue(f.followupDate);
                const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ');
                return (
                  <TableRow key={f.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{lead?.company || name || '—'}</Typography>
                      {(lead?.company && name) ? (
                        <Typography variant="caption" color="text.secondary">
                          {name}{lead?.designation ? ` · ${lead.designation}` : ''}
                        </Typography>
                      ) : lead?.designation ? (
                        <Typography variant="caption" color="text.secondary">{lead.designation}</Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {lead?.mobile && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <PhoneIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            <Typography variant="caption">{lead.mobile}</Typography>
                          </Stack>
                        )}
                        {lead?.email && (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <EmailIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                            <Typography variant="caption" noWrap sx={{ maxWidth: 180 }} title={lead.email}>{lead.email}</Typography>
                          </Stack>
                        )}
                        {!lead?.mobile && !lead?.email && <Typography variant="caption" color="text.disabled">—</Typography>}
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="caption">{lead?.eventName || '—'}</Typography></TableCell>
                    <TableCell>
                      <Tooltip title="Click to change lead status">
                        <Box component="span" sx={{ cursor: 'pointer' }} onClick={(e) => setStatusMenu({ el: e.currentTarget, row: f })}>
                          {lead ? <StatusChip status={lead.status as never} /> : '—'}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={overdue ? 'error.main' : 'text.primary'} sx={{ fontWeight: overdue ? 700 : 400 }}>
                        {new Date(f.followupDate).toLocaleDateString()} {f.followupTime ?? ''}
                      </Typography>
                      {overdue && <Typography variant="caption" color="error.main">Overdue</Typography>}
                    </TableCell>
                    <TableCell><Chip size="small" label={sentenceCase(f.priority)} color={PRIORITY_COLOR[f.priority] ?? 'default'} /></TableCell>
                    {isManager && (
                      <TableCell><Typography variant="caption">{f.assignee ? `${f.assignee.firstName} ${f.assignee.lastName}` : '—'}</Typography></TableCell>
                    )}
                    <TableCell><Typography variant="caption" sx={{ display: 'block', maxWidth: 200 }} title={f.note ?? ''} noWrap>{f.note || '—'}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButtonMenu onClick={(e) => setRowMenu({ el: e, row: f })} />
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isFetching && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isManager ? 9 : 8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No follow-ups in this view
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Lead-status change menu */}
      <Menu anchorEl={statusMenu?.el} open={!!statusMenu} onClose={() => setStatusMenu(null)}>
        {LEAD_STATUSES.map((s) => (
          <MenuItem
            key={s}
            selected={statusMenu?.row.lead?.status === s}
            onClick={() => statusMenu && applyLeadStatus(statusMenu.row, s)}
          >
            {sentenceCase(s)}
          </MenuItem>
        ))}
      </Menu>

      {/* Row action menu */}
      <Menu anchorEl={rowMenu?.el} open={!!rowMenu} onClose={() => setRowMenu(null)}>
        <MenuItem onClick={() => { if (rowMenu?.row.lead) navigate(`/leads/${rowMenu.row.lead.id}`); setRowMenu(null); }}>
          <OpenInNewIcon fontSize="small" style={{ marginRight: 8 }} /> Open lead
        </MenuItem>
        <MenuItem onClick={() => { if (rowMenu) setReschedule({ row: rowMenu.row, date: rowMenu.row.followupDate.slice(0, 10), time: rowMenu.row.followupTime ?? '' }); setRowMenu(null); }}>
          <EventRepeatIcon fontSize="small" style={{ marginRight: 8 }} /> Reschedule
        </MenuItem>
        <MenuItem onClick={() => rowMenu && markDone(rowMenu.row)}>
          <CheckCircleOutlineIcon fontSize="small" style={{ marginRight: 8 }} /> Mark done
        </MenuItem>
      </Menu>

      {/* Reschedule dialog */}
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

// Small helper so the kebab passes the anchor element up cleanly.
function IconButtonMenu({ onClick }: { onClick: (el: HTMLElement) => void }) {
  return (
    <Tooltip title="More">
      <span>
        <Button size="small" sx={{ minWidth: 0, px: 1 }} onClick={(e) => onClick(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </Button>
      </span>
    </Tooltip>
  );
}
