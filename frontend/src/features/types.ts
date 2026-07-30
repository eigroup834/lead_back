import type { LeadStatus } from '@/constants';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface Lead {
  id: string;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  eventName: string | null;
  status: LeadStatus;
  priority: string;
  source?: string;
  sourceChannel?: string | null;
  leadType?: string | null;
  assignedUserId: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
  shellSpace: string | null;
  rawSpace: string | null;
  createDate: string | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface LeadDetail extends Lead {
  designation: string | null;
  address: string | null;
  website: string | null;
  learnAbout: string | null;
  remarks: string | null;
  statusHistory: Array<{ id: string; fromStatus: LeadStatus | null; toStatus: LeadStatus; reason: string | null; createdAt: string; changedBy?: { firstName: string; lastName: string } }>;
  assignments: Array<{ id: string; type: string; createdAt: string; assignedTo?: { firstName: string; lastName: string }; assignedBy?: { firstName: string; lastName: string } }>;
  notes: Array<{ id: string; body: string; createdAt: string; author?: { firstName: string; lastName: string } }>;
  followups: Array<{ id: string; followupDate: string; followupTime: string | null; priority: string; status: string; note: string | null }>;
}

export interface DashboardSummary {
  total: number;
  today: number;
  assigned: number;
  unassigned: number;
  converted: number;
  lost: number;
  conversionRate: number;
}

export interface TeamPerf {
  userId: string;
  name: string;
  assigned: number;
  converted: number;
  calls: number;
  followupsDone: number;
  conversionRate: number;
}
