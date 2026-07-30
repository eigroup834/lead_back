
export const PERMISSIONS = [
  { key: 'lead.view', module: 'lead', description: 'View leads' },
  { key: 'lead.create', module: 'lead', description: 'Manually add leads' },
  { key: 'lead.edit', module: 'lead', description: 'Edit lead fields/status' },
  { key: 'lead.assign', module: 'lead', description: 'Assign / reassign leads' },
  { key: 'lead.delete', module: 'lead', description: 'Soft-delete leads' },
  { key: 'lead.export', module: 'lead', description: 'Export leads' },
  { key: 'lead.sync', module: 'lead', description: 'Trigger / view source sync' },
  { key: 'lead.note', module: 'lead', description: 'Add notes' },
  { key: 'lead.followup', module: 'lead', description: 'Schedule follow-ups' },
  { key: 'historical.view', module: 'historical', description: 'View own historical data uploads' },
  { key: 'historical.manage', module: 'historical', description: 'Upload historical data & convert rows to leads' },
  { key: 'user.view', module: 'user', description: 'View users' },
  { key: 'user.create', module: 'user', description: 'Create users' },
  { key: 'user.update', module: 'user', description: 'Update users' },
  { key: 'user.delete', module: 'user', description: 'Deactivate users' },
  { key: 'role.manage', module: 'role', description: 'Manage roles & permission matrix' },
  { key: 'department.manage', module: 'department', description: 'Manage departments & teams' },
  { key: 'dashboard.view', module: 'dashboard', description: 'View dashboards' },
  { key: 'analytics.view', module: 'analytics', description: 'View team analytics' },
  { key: 'report.export', module: 'report', description: 'Generate & export reports' },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const ROLES = [
  { name: 'SUPER_ADMIN', label: 'Super Admin', level: 1 },
  { name: 'HEAD', label: 'Head', level: 2 },
  { name: 'SALES_EXECUTIVE', label: 'Group Manager', level: 4 },
  { name: 'EXECUTIVE', label: 'Executive', level: 4 },
] as const;

const ALL = PERMISSIONS.map((p) => p.key);

const FIELD_SALES: PermissionKey[] = [
  'lead.view', 'lead.edit', 'lead.note', 'lead.followup', 'dashboard.view',
  'historical.view', 'historical.manage',
];

export const ROLE_MATRIX: Record<string, PermissionKey[] | '*'> = {
  SUPER_ADMIN: '*',
  HEAD: [
    'lead.view', 'lead.create', 'lead.edit', 'lead.assign', 'lead.export', 'lead.note', 'lead.followup',
    'historical.view', 'historical.manage',
    'user.view', 'user.create', 'user.update',
    'dashboard.view', 'analytics.view', 'report.export',
  ],
  SALES_EXECUTIVE: FIELD_SALES,
  EXECUTIVE: FIELD_SALES,
};

export function resolveMatrix(roleName: string): PermissionKey[] {
  const entry = ROLE_MATRIX[roleName];
  if (entry === '*') return ALL as PermissionKey[];
  return entry ?? [];
}
