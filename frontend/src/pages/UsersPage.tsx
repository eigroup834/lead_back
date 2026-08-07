import { useState } from 'react';
import {
  Box, Card, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, Alert,
  Divider,
  IconButton, Tooltip, InputAdornment,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useListUsersQuery, useCreateUserMutation, useUpdateUserMutation, useListRolesQuery, useLazyGetCredentialQuery, type UserRow } from '@/features/adminApi';
import SalesTargetEditor, { toDrafts, fromDrafts, draftsInvalid, type TargetDraft } from '@/components/SalesTargetEditor';
import { usePermissions } from '@/hooks/usePermissions';
import { sentenceCase, formatDateTime } from '@/constants';
import { SortableCell, useSort } from '@/components/SortableCell';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import { SkeletonRows } from '@/components/Skeletons';

type UserSortKey = 'firstName' | 'email' | 'phone' | 'status' | 'lastLoginAt' | 'createdAt';

const empty = { email: '', phone: '', password: '', firstName: '', lastName: '', roleId: '' };

function createErrorMessage(error: unknown): string {
  const data = (error as { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } })?.data;
  const e = data?.error;
  if (!e) return 'Could not create user. Please check your connection and try again.';
  const fieldErrors = e.details?.fieldErrors;
  if (fieldErrors) {
    const first = Object.entries(fieldErrors).find(([, msgs]) => msgs?.length);
    if (first) return `${first[0]}: ${first[1][0]}`;
  }
  return e.message ?? 'Could not create user.';
}

export default function UsersPage() {
  const { has, level, user } = usePermissions();
  const isSuperAdmin = level === 1;
  const { sort, toggle: toggleSort } = useSort<UserSortKey>({ by: 'createdAt', dir: 'desc' });
  const { data, isFetching } = useListUsersQuery({ sortBy: sort.by, sortDir: sort.dir });
  const { data: roles } = useListRolesQuery(undefined, { skip: !has('user.create') && !has('user.update') });
  const [createUser, { isLoading, error }] = useCreateUserMutation();
  const [updateUser, { isLoading: isSaving, error: editError }] = useUpdateUserMutation();
  const [fetchCredential] = useLazyGetCredentialQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ email: '', phone: '', firstName: '', lastName: '', roleId: '' });
  const [reveal, setReveal] = useState<{ name: string; password: string | null } | null>(null);
  const [statusTarget, setStatusTarget] = useState<UserRow | null>(null);
  const [newTargets, setNewTargets] = useState<TargetDraft[]>([]);
  const [editTargets, setEditTargets] = useState<TargetDraft[]>([]);

  const users = data?.data ?? [];
  const canEdit = has('user.update');
  const colCount = 6 + (canEdit || isSuperAdmin ? 1 : 0);
  const assignableRoles = (roles?.data ?? []).filter((r) => r.level >= level);

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditForm({
      email: u.email, phone: u.phone ?? '', firstName: u.firstName, lastName: u.lastName,
      roleId: u.roles[0]?.role.id ?? '',
    });
    setEditTargets(toDrafts(u.salesTargets));
  };
  const setEdit = (k: keyof typeof editForm) => (e: { target: { value: string } }) => setEditForm((f) => ({ ...f, [k]: e.target.value }));
  const saveEdit = async () => {
    if (!editUser) return;
    const { roleId, ...rest } = editForm;
    await updateUser({
      id: editUser.id, ...rest, phone: rest.phone || null,
      roleIds: roleId && roleId !== editUser.roles[0]?.role.id ? [roleId] : undefined,
      targets: fromDrafts(editTargets),
    }).unwrap();
    setEditUser(null);
  };

  const toggleStatus = async () => {
    if (!statusTarget) return;
    const next = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateUser({ id: statusTarget.id, status: next }).unwrap();
    } finally {
      setStatusTarget(null);
    }
  };

  const revealPassword = async (id: string, name: string) => {
    const res = await fetchCredential(id).unwrap();
    setReveal({ name, password: res.data.password });
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await createUser({
      email: form.email, phone: form.phone || undefined, password: form.password, firstName: form.firstName, lastName: form.lastName,
      roleIds: [form.roleId],
      targets: fromDrafts(newTargets),
    }).unwrap();
    setOpen(false); setForm(empty); setNewTargets([]);
  };

  return (
    <Box>
      <PageHeader
        title="Users"
        subtitle="Team accounts, their roles and access."
        actions={has('user.create') && (
          <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setOpen(true)}>New User</Button>
        )}
      />

      <Card>
        <Table size="small">
          <TableHead>
            <TableRow>
              <SortableCell field="firstName" sort={sort} onSort={toggleSort}>Name</SortableCell>
              <SortableCell field="email" sort={sort} onSort={toggleSort}>Email</SortableCell>
              <SortableCell field="phone" sort={sort} onSort={toggleSort}>Phone</SortableCell>
              <TableCell sx={{ fontWeight: 700 }}>Roles</TableCell>
              <SortableCell field="status" sort={sort} onSort={toggleSort}>Status</SortableCell>
              <SortableCell field="lastLoginAt" sort={sort} onSort={toggleSort}>Last Login</SortableCell>
              {(canEdit || isSuperAdmin) && <TableCell align="right" sx={{ fontWeight: 700, pr: 2 }}>Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell>{u.firstName} {u.lastName}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.phone || '—'}</TableCell>
                <TableCell>{u.roles.map((r) => <Chip key={r.role.id} size="small" label={r.role.label} sx={{ mr: 0.5 }} />)}</TableCell>
                <TableCell><Chip size="small" label={sentenceCase(u.status)} color={u.status === 'ACTIVE' ? 'success' : 'default'} /></TableCell>
                <TableCell>{formatDateTime(u.lastLoginAt)}</TableCell>
                {(canEdit || isSuperAdmin) && (
                  <TableCell align="right" sx={{ pr: 2 }}>
                    <RowActions
                      limit={3}
                      actions={[
                        { label: 'Edit', onClick: () => openEdit(u), hidden: !canEdit },
                        {
                          label: 'Password',
                          onClick: () => revealPassword(u.id, `${u.firstName} ${u.lastName}`),
                          hidden: !isSuperAdmin,
                        },
                        {
                          label: u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate',
                          onClick: () => setStatusTarget(u),
                          hidden: !canEdit || !isSuperAdmin || u.id === user?.id,
                        },
                      ]}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {isFetching && users.length === 0 && (
              <SkeletonRows rows={8} columns={colCount} />
            )}
            {!isFetching && users.length === 0 && (
              <TableRow><TableCell colSpan={colCount} align="center" sx={{ py: 5, color: 'text.secondary' }}>No users</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create User</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{createErrorMessage(error)}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="First name" fullWidth value={form.firstName} onChange={set('firstName')} />
              <TextField label="Last name" fullWidth value={form.lastName} onChange={set('lastName')} />
            </Stack>
            <TextField label="Email" type="email" fullWidth value={form.email} onChange={set('email')} />
            <TextField label="Phone" type="tel" fullWidth value={form.phone} onChange={set('phone')} helperText="Optional — used for follow-up reminders" />
            <TextField label="Password" type="password" fullWidth value={form.password} onChange={set('password')} helperText="Min 8 characters" />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={form.roleId} onChange={set('roleId')}>
                {assignableRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Divider />
            <SalesTargetEditor value={newTargets} onChange={setNewTargets} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={isLoading || !form.email || !form.password || !form.roleId || draftsInvalid(newTargets)} onClick={submit}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editUser} onClose={() => setEditUser(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{createErrorMessage(editError)}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField label="First name" fullWidth value={editForm.firstName} onChange={setEdit('firstName')} />
              <TextField label="Last name" fullWidth value={editForm.lastName} onChange={setEdit('lastName')} />
            </Stack>
            <TextField label="Email" type="email" fullWidth value={editForm.email} onChange={setEdit('email')} />
            <TextField label="Phone" type="tel" fullWidth value={editForm.phone} onChange={setEdit('phone')} helperText="Optional — used for follow-up reminders" />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select label="Role" value={editForm.roleId} onChange={setEdit('roleId')}>
                {assignableRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>
            {editUser?.id === user?.id && (
              <Alert severity="info">You can't change your own role.</Alert>
            )}
            <Divider />
            <SalesTargetEditor value={editTargets} onChange={setEditTargets} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" disabled={isSaving || !editForm.email || draftsInvalid(editTargets)} onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate / reactivate confirmation */}
      <Dialog open={!!statusTarget} onClose={() => setStatusTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {statusTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} {statusTarget?.firstName} {statusTarget?.lastName}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {statusTarget?.status === 'ACTIVE'
              ? 'They will no longer be able to sign in. Their leads, follow-ups and history stay exactly as they are, and you can reactivate them at any time.'
              : 'They will be able to sign in again with their existing password.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            color={statusTarget?.status === 'ACTIVE' ? 'error' : 'primary'}
            disabled={isSaving}
            onClick={toggleStatus}
          >
            {statusTarget?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SUPER_ADMIN password reveal */}
      <Dialog open={!!reveal} onClose={() => setReveal(null)} fullWidth maxWidth="xs">
        <DialogTitle>Password — {reveal?.name}</DialogTitle>
        <DialogContent>
          {reveal?.password ? (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>Sensitive — handle with care.</Alert>
              <TextField
                fullWidth value={reveal.password} InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Copy"><IconButton onClick={() => navigator.clipboard?.writeText(reveal.password!)}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </>
          ) : (
            <Alert severity="info">No stored password for this user (created before reveal was enabled). Reset their password to capture it.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReveal(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
