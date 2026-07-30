import { api } from '@/app/api';
import type { ApiEnvelope, Lead, PageMeta } from '@/features/types';

export interface ExhHistoryEntry {
  year: number;
  sqm_spo: string;
}

export interface HistoricalLead {
  id: string;
  eventYear: number | null;
  eventName: string | null;
  company: string | null;
  name: string | null;
  email: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  designation: string | null;
  status: string;
  sourceLeadId: string | null;
  restoredLeadId: string | null;
  archivedAt: string;
  histCode: string | null;
  branchOffice: string | null;
  assignedTo: string | null;
  assignedUserId: string | null;
  assignedUser: { id: string; firstName: string; lastName: string } | null;
  industry: string | null;
  spaceSqm: string | null;
  remark: string | null;
  specialRemarks: string | null;
  exhHistory: ExhHistoryEntry[];
}

export interface HistoricalListParams {
  page?: number;
  limit?: number;
  q?: string;
  year?: number;
  assigneeId?: string;
  eventName?: string;
  noEventName?: boolean; 
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface HistoricalEditChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

export interface HistoricalEdit {
  id: string;
  createdAt: string;
  changes: HistoricalEditChange[];
  editedBy: { id: string; firstName: string; lastName: string } | null;
}

export const historicalApi = api.injectEndpoints({
  endpoints: (build) => ({
    listHistoricalLeads: build.query<ApiEnvelope<HistoricalLead[]> & { meta: PageMeta }, HistoricalListParams>({
      query: (params) => ({ url: '/historical/leads', params }),
      providesTags: ['Historical'],
    }),
    historicalYears: build.query<ApiEnvelope<Array<{ year: number; count: number }>>, void>({
      query: () => '/historical/leads/years',
      providesTags: ['Historical'],
    }),
    historicalEvents: build.query<ApiEnvelope<Array<{ event: string | null; count: number }>>, void>({
      query: () => '/historical/leads/events',
      providesTags: ['Historical'],
    }),
    historicalLeadHistory: build.query<ApiEnvelope<HistoricalEdit[]>, string>({
      query: (id) => `/historical/leads/${id}/history`,
      providesTags: (_r, _e, id) => [{ type: 'Historical', id }],
    }),
    restoreHistoricalLeads: build.mutation<ApiEnvelope<{ restored: number; skipped: number; total: number }>, string[]>({
      query: (ids) => ({ url: '/historical/leads/restore', method: 'POST', body: { ids } }),
      invalidatesTags: ['Historical', 'Leads', 'Dashboard'],
    }),
    deleteHistoricalLead: build.mutation<ApiEnvelope<{ deleted: boolean }>, string>({
      query: (id) => ({ url: `/historical/leads/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Historical'],
    }),
    createHistoricalLead: build.mutation<ApiEnvelope<HistoricalLead>, {
      company?: string; name?: string; designation?: string; email?: string; mobile?: string;
      city?: string; country?: string; eventName?: string; eventYear?: number; assignedUserId?: string;
    }>({
      query: (body) => ({ url: '/historical/leads', method: 'POST', body }),
      invalidatesTags: ['Historical'],
    }),
    updateHistoricalLead: build.mutation<ApiEnvelope<HistoricalLead>, {
      id: string;
      company?: string | null; name?: string | null; designation?: string | null;
      email?: string | null; mobile?: string | null; city?: string | null; country?: string | null;
      eventName?: string | null; eventYear?: number | null; industry?: string | null;
      branchOffice?: string | null; remark?: string | null; specialRemarks?: string | null;
      spaceSqm?: string | null; assignedUserId?: string | null; exhHistory?: ExhHistoryEntry[];
    }>({
      query: ({ id, ...body }) => ({ url: `/historical/leads/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => ['Historical', { type: 'Historical' as const, id }],
    }),
  }),
});

export const {
  useListHistoricalLeadsQuery,
  useHistoricalYearsQuery,
  useHistoricalEventsQuery,
  useHistoricalLeadHistoryQuery,
  useRestoreHistoricalLeadsMutation,
  useDeleteHistoricalLeadMutation,
  useCreateHistoricalLeadMutation,
  useUpdateHistoricalLeadMutation,
} = historicalApi;

export type { Lead };
