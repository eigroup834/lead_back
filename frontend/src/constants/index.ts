import type { SvgIconComponent } from '@mui/icons-material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HistoryIcon from '@mui/icons-material/History';
import InsightsIcon from '@mui/icons-material/Insights';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';

export const LEAD_STATUSES = [
  'NEW', 'ASSIGNED', 'CONTACTED', 'NOT_REACHABLE', 'INTERESTED', 'NOT_INTERESTED',
  'FOLLOW_UP', 'HOT', 'WARM', 'COLD', 'CONVERTED', 'INVALID', 'LOST',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// Statuses a rep can set manually on the lead detail page (the rest are
// system-managed or not in use yet).
export const LEAD_DETAIL_STATUS_OPTIONS: LeadStatus[] = [
  'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'CONVERTED', 'INVALID', 'NOT_REACHABLE',
];

// status -> MUI chip color
export const STATUS_COLOR: Record<LeadStatus, 'default' | 'info' | 'primary' | 'success' | 'warning' | 'error'> = {
  NEW: 'info',
  ASSIGNED: 'primary',
  CONTACTED: 'primary',
  NOT_REACHABLE: 'warning',
  INTERESTED: 'success',
  NOT_INTERESTED: 'error',
  FOLLOW_UP: 'warning',
  HOT: 'error',
  WARM: 'warning',
  COLD: 'default',
  CONVERTED: 'success',
  INVALID: 'default',
  LOST: 'error',
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof PRIORITIES)[number];

// priority -> MUI chip color
export const PRIORITY_COLOR: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export const LEAD_SOURCES = [
  'WEBSITE', 'MANUAL', 'REFERRAL', 'WALK_IN', 'EMAIL', 'PHONE', 'SOCIAL_MEDIA', 'PARTNER', 'OTHER',
] as const;

export const LEAD_TYPES = ['EXHIBITION', 'VISITOR', 'DELEGATE', 'SPEAKER'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

// ---------------------------------------------------------------------------
// External (non-exhibitor) leads
// ---------------------------------------------------------------------------

// Non-exhibitor lead types. These live in the external/local-CRM list, not the
// exhibitor Lead table — converting a lead to one of these moves it out of Lead
// Management.
export const EXTERNAL_LEAD_TYPES = ['VISITOR', 'DELEGATE', 'SPEAKER'] as const;
export type ExternalLeadType = (typeof EXTERNAL_LEAD_TYPES)[number];

// Staging categories in Other Leads. Adds OTHER for unrecognized interests,
// which is never dropped so a lead is never silently lost.
export const EXTERNAL_CATEGORIES = [...EXTERNAL_LEAD_TYPES, 'OTHER'] as const;
export type ExternalCategory = (typeof EXTERNAL_CATEGORIES)[number];

// category -> MUI chip color
export const CATEGORY_COLOR: Record<string, 'info' | 'secondary' | 'warning' | 'default'> = {
  VISITOR: 'info',
  DELEGATE: 'secondary',
  SPEAKER: 'warning',
  OTHER: 'default',
};

// Sentinel used by the Other Leads classify popup. Not an ExternalCategory:
// choosing it moves the lead into Lead Management as an exhibitor lead instead
// of reclassifying it in place.
export const EXHIBITOR = 'EXHIBITOR';

// Options shown in the classify popup, in display order.
export const RECLASSIFY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: EXHIBITOR, label: 'Exhibitor — move to Lead Management' },
  ...EXTERNAL_CATEGORIES.map((c) => ({ value: c, label: prettyLabel(c) })),
];

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

export const FOLLOWUP_SCOPES = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
] as const;

// ---------------------------------------------------------------------------
// Assignment & charts
// ---------------------------------------------------------------------------

// Only team leaders (3) & sales executives (4) are sensible assignment targets.
export const ASSIGNABLE_ROLE_LEVELS = [3, 4];

// Shared categorical palette for charts (pie slices, series).
export const CHART_COLORS = [
  '#4f46e5', '#0ea5e9', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#65a30d', '#db2777', '#475569', '#ca8a04',
];

// Leaderboard rank colors: gold, silver, bronze.
export const MEDAL_COLORS = ['#facc15', '#cbd5e1', '#d97706'];

// Lead source channels — drives the Source filter and the Source column.
// GOOGLE / LINKEDIN have no data yet (coming later) but appear as options.
export const LEAD_SOURCE_CHANNELS = [
  { value: 'SPACE_BOOKING', label: 'Space Booking Form' },
  { value: 'POST_SHOW_DOWNLOAD', label: 'Post Show' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'META', label: 'Meta' },
] as const;

// Pretty label for an UPPER_SNAKE enum value, e.g. SOCIAL_MEDIA -> "Social Media".
// Declared as a function (not a const arrow) so it is hoisted — constants defined
// above, such as RECLASSIFY_OPTIONS, call it at module-init time.
export function prettyLabel(v: string): string {
  return v.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Human label for a source channel value; falls back to prettyLabel.
export const sourceChannelLabel = (v?: string | null) =>
  LEAD_SOURCE_CHANNELS.find((c) => c.value === v)?.label ?? (v ? prettyLabel(v) : '');

// Sentence case for an UPPER_SNAKE enum value, e.g. NOT_REACHABLE -> "Not reachable".
export const sentenceCase = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface NavItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
  permission?: string; // required permission key (omitted = any authenticated)
  maxLevel?: number; // only visible to users at or above this role level (1 = Super Admin, 2 = Head, …)
}

// Sidebar menu — items are filtered by the user's permission set at render time.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon, permission: 'dashboard.view' },
  { label: 'Lead Management', path: '/leads', icon: GroupsIcon, permission: 'lead.view', maxLevel: 2 },
  { label: 'Assigned Leads', path: '/leads/assigned', icon: AssignmentIndIcon, permission: 'lead.view' },
  { label: 'Followups', path: '/followups', icon: EventNoteIcon, permission: 'lead.view' },
  { label: 'Historical Data', path: '/historical', icon: HistoryIcon, permission: 'historical.view' },
  { label: 'Brochure Data', path: '/other-leads', icon: GroupWorkIcon, permission: 'lead.view' },
  { label: 'Add Lead', path: '/leads/new', icon: PersonAddAlt1Icon, permission: 'lead.create' },
  { label: 'Analytics', path: '/analytics', icon: InsightsIcon, permission: 'analytics.view' },
  { label: 'Users', path: '/users', icon: PeopleIcon, permission: 'user.view' },
  { label: 'Roles', path: '/roles', icon: SecurityIcon, permission: 'role.manage' },
  { label: 'Settings', path: '/settings', icon: SettingsIcon, maxLevel: 1 },
];
