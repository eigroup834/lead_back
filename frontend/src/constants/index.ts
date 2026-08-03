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

export const LEAD_DETAIL_STATUS_OPTIONS: LeadStatus[] = [
  'INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'CONVERTED', 'INVALID', 'NOT_REACHABLE',
];

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

export const EXTERNAL_LEAD_TYPES = ['VISITOR', 'DELEGATE', 'SPEAKER'] as const;
export type ExternalLeadType = (typeof EXTERNAL_LEAD_TYPES)[number];

export const EXTERNAL_CATEGORIES = [...EXTERNAL_LEAD_TYPES, 'OTHER'] as const;
export type ExternalCategory = (typeof EXTERNAL_CATEGORIES)[number];

export const CATEGORY_COLOR: Record<string, 'info' | 'secondary' | 'warning' | 'default'> = {
  VISITOR: 'info',
  DELEGATE: 'secondary',
  SPEAKER: 'warning',
  OTHER: 'default',
};

export const EXHIBITOR = 'EXHIBITOR';

export const RECLASSIFY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: EXHIBITOR, label: 'Exhibitor — move to Lead Management' },
  ...EXTERNAL_CATEGORIES.map((c) => ({ value: c, label: prettyLabel(c) })),
];

export const FOLLOWUP_SCOPES = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
] as const;

export const ASSIGNABLE_ROLE_LEVELS = [3, 4];

export const CHART_COLORS = [
  '#4f46e5', '#0ea5e9', '#16a34a', '#d97706', '#dc2626',
  '#7c3aed', '#0891b2', '#65a30d', '#db2777', '#475569', '#ca8a04',
];

export const MEDAL_COLORS = ['#facc15', '#cbd5e1', '#d97706'];

export const LEAD_SOURCE_CHANNELS = [
  { value: 'SPACE_BOOKING', label: 'Space Booking Form' },
  { value: 'POST_SHOW_DOWNLOAD', label: 'Post Show' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'META', label: 'Meta' },
] as const;

export const HISTORICAL_INDUSTRIES = [
  'AI, Agentic AI & Machine Learning',
  'Broadband, Fiber Optic & Cables',
  'Cybersecurity',
  'Datacenter & Cloud',
  'Fintech & Banking',
  'Green Technology, Energy Tech & ESG',
  'Information & Communications Technologies (ICT)',
  'IoT, Edge Computing & Digital Twins',
  'IPTV & OTT Streaming',
  'Mobile Devices, Accessories',
  'Robotics, Drones & Autonomous Systems',
  'Satellite Communications & Space Tech',
  'Security & Surveillance',
  'Semiconductors & Electronics Manufacturing',
  'Smart Devices',
  'Smart Future Cities & Digital Infrastructure',
  'Smart Mobility & Connected Vehicles',
  'Startups, Innovation Hubs & Incubators',
  'Telecom, 5G, 6G & Network Infrastructure',
] as const;

export const NAME_RE = /^[A-Za-z\s.'-]+$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MOBILE_RE = /^[+]?[\d\s-]{7,20}$/;

export function prettyLabel(v: string): string {
  return v.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export const sourceChannelLabel = (v?: string | null) =>
  LEAD_SOURCE_CHANNELS.find((c) => c.value === v)?.label ?? (v ? prettyLabel(v) : '');

export const sentenceCase = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export interface NavItem {
  label: string;
  path: string;
  icon: SvgIconComponent;
  permission?: string; 
  maxLevel?: number; 
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon, permission: 'dashboard.view', maxLevel: 1 },
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

export const landingPath = (level: number) => (level === 1 ? '/dashboard' : '/leads/assigned');

export const leadsListPath = (level: number) => (level <= 2 ? '/leads' : '/leads/assigned');
