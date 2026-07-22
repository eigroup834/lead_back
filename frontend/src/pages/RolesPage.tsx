import { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, CardHeader, Typography, Grid, List, ListItemButton, ListItemText,
  Checkbox, FormControlLabel, Button, Chip, Divider, Stack,
} from '@mui/material';
import { useListRolesQuery, useListPermissionsQuery, useSetRolePermissionsMutation } from '@/features/adminApi';

export default function RolesPage() {
  const { data: roles } = useListRolesQuery();
  const { data: perms } = useListPermissionsQuery();
  const [save, { isLoading: saving }] = useSetRolePermissionsMutation();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});

  const roleList = roles?.data ?? [];
  const permList = perms?.data ?? [];
  const active = roleList.find((r) => r.id === selectedRole) ?? roleList[0];

  // group permissions by module for the matrix
  const grouped = useMemo(() => {
    const g: Record<string, typeof permList> = {};
    permList.forEach((p) => { (g[p.module] ??= []).push(p); });
    return g;
  }, [permList]);

  const selectRole = (id: string) => {
    setSelectedRole(id);
    const role = roleList.find((r) => r.id === id);
    const map: Record<string, boolean> = {};
    permList.forEach((p) => { map[p.id] = !!role?.permissions.includes(p.key); });
    setDraft(map);
  };

  // initialize the draft matrix once roles + permissions have loaded
  useEffect(() => {
    if (active && permList.length && Object.keys(draft).length === 0) {
      const map: Record<string, boolean> = {};
      permList.forEach((p) => { map[p.id] = !!active.permissions.includes(p.key); });
      setSelectedRole(active.id);
      setDraft(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, permList.length]);

  const onSave = async () => {
    if (!active) return;
    const permissionIds = permList.filter((p) => draft[p.id]).map((p) => p.id);
    await save({ id: active.id, permissionIds }).unwrap();
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>Roles & Permissions</Typography>
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardHeader title="Roles" titleTypographyProps={{ variant: 'h6' }} />
            <List>
              {roleList.map((r) => (
                <ListItemButton key={r.id} selected={active?.id === r.id} onClick={() => selectRole(r.id)}>
                  <ListItemText primary={r.label} secondary={`Level ${r.level} · ${r.userCount} users`} />
                  {r.isSystem && <Chip label="system" size="small" />}
                </ListItemButton>
              ))}
            </List>
          </Card>
        </Grid>

        <Grid item xs={12} md={9}>
          <Card>
            <CardHeader
              title={active ? `Access & Permissions` : 'Access Control Center'}
              action={<Button variant="contained" onClick={onSave} disabled={saving || !active}>Save</Button>}
            />
            <CardContent>
              {Object.entries(grouped).map(([module, list]) => (
                <Box key={module} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mb: 1 }}>{module}</Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {list.map((p) => (
                      <FormControlLabel
                        key={p.id}
                        sx={{ width: 240, m: 0 }}
                        control={<Checkbox size="small" checked={!!draft[p.id]} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.checked }))} />}
                        label={<Typography variant="body2">{p.key}</Typography>}
                      />
                    ))}
                  </Stack>
                  <Divider sx={{ mt: 1 }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
