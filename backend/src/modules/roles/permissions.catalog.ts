// Central, dynamic permission catalog. The seed loads these into the
// `permissions` table and wires the default role→permission matrix into
// `role_permissions`. Admins can re-wire the matrix at runtime via the API —
// nothing here is hardcoded into route handlers (routes reference permission
// KEYS only, resolved against the DB-backed matrix).

export const PERMISSIONS = [
  // leads
  { key: 'lead.view', module: 'lead', description: 'View leads' },
  { key: 'lead.create', module: 'lead', description: 'Manually add leads' },
  { key: 'lead.edit', module: 'lead', description: 'Edit lead fields/status' },
  { key: 'lead.assign', module: 'lead', description: 'Assign / reassign leads' },
  { key: 'lead.delete', module: 'lead', description: 'Soft-delete leads' },
  { key: 'lead.export', module: 'lead', description: 'Export leads' },
  { key: 'lead.sync', module: 'lead', description: 'Trigger / view source sync' },
  { key: 'lead.note', module: 'lead', description: 'Add notes' },
  { key: 'lead.followup', module: 'lead', description: 'Schedule follow-ups' },
  // historical data (per-user uploaded follow-up sheets)
  { key: 'historical.view', module: 'historical', description: 'View own historical data uploads' },
  { key: 'historical.manage', module: 'historical', description: 'Upload historical data & convert rows to leads' },
  // users & org
  { key: 'user.view', module: 'user', description: 'View users' },
  { key: 'user.create', module: 'user', description: 'Create users' },
  { key: 'user.update', module: 'user', description: 'Update users' },
  { key: 'user.delete', module: 'user', description: 'Deactivate users' },
  { key: 'role.manage', module: 'role', description: 'Manage roles & permission matrix' },
  { key: 'department.manage', module: 'department', description: 'Manage departments & teams' },
  // analytics / dashboards / reports
  { key: 'dashboard.view', module: 'dashboard', description: 'View dashboards' },
  { key: 'analytics.view', module: 'analytics', description: 'View team analytics' },
  { key: 'report.export', module: 'report', description: 'Generate & export reports' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const ROLES = [
  { name: 'SUPER_ADMIN', label: 'Super Admin', level: 1 },
  { name: 'HEAD', label: 'Head', level: 2 },
  { name: 'TEAM_LEADER', label: 'Team Leader', level: 3 },
  { name: 'SALES_EXECUTIVE', label: 'Sales Executive', level: 4 },
] as const;

const ALL = PERMISSIONS.map((p) => p.key);

// Default matrix (seed only — editable at runtime).
export const ROLE_MATRIX: Record<string, PermissionKey[] | '*'> = {
  SUPER_ADMIN: '*', // everything
  HEAD: [
    'lead.view', 'lead.create', 'lead.edit', 'lead.assign', 'lead.export', 'lead.note', 'lead.followup',
    'historical.view', 'historical.manage',
    'user.view', 'user.create', 'user.update',
    'dashboard.view', 'analytics.view', 'report.export',
  ],
  TEAM_LEADER: [
    'lead.view', 'lead.create', 'lead.edit', 'lead.assign', 'lead.note', 'lead.followup',
    'historical.view', 'historical.manage',
    'user.view', 'dashboard.view', 'analytics.view',
  ],
  SALES_EXECUTIVE: [
    'lead.view', 'lead.edit', 'lead.note', 'lead.followup', 'dashboard.view',
    'historical.view', 'historical.manage',
  ],
};

export function resolveMatrix(roleName: string): PermissionKey[] {
  const entry = ROLE_MATRIX[roleName];
  if (entry === '*') return ALL as PermissionKey[];
  return entry ?? [];
}
