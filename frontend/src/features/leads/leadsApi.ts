import { api } from '@/app/api';
import type { ApiEnvelope, Lead, LeadDetail, PageMeta } from '@/features/types';
import type { ExternalLeadType } from '@/constants';

export interface LeadListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string[];
  sourceChannel?: string;
  source?: string;
  country?: string;
  assignedUserId?: string;
  unassigned?: boolean;
  assigned?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const leadsApi = api.injectEndpoints({
  endpoints: (build) => ({
    listLeads: build.query<ApiEnvelope<Lead[]> & { meta: PageMeta }, LeadListParams>({
      query: (params) => ({ url: '/leads', params }),
      providesTags: ['Leads'],
    }),
    getLead: build.query<ApiEnvelope<LeadDetail>, string>({
      query: (id) => `/leads/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Lead', id }],
    }),
    createLead: build.mutation<ApiEnvelope<Lead>, Record<string, unknown>>({
      query: (body) => ({ url: '/leads', method: 'POST', body }),
      invalidatesTags: ['Leads', 'Dashboard'],
    }),
    updateLead: build.mutation<ApiEnvelope<Lead>, { id: string; body: Partial<Lead> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, 'Leads'],
    }),
    changeStatus: build.mutation<ApiEnvelope<Lead>, { id: string; status: string; reason?: string; sqmSpace?: string }>({
      query: ({ id, ...body }) => ({ url: `/leads/${id}/status`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, 'Leads', 'Dashboard'],
    }),
    convertExternal: build.mutation<ApiEnvelope<unknown>, { id: string; type: ExternalLeadType }>({
      query: ({ id, type }) => ({ url: `/leads/${id}/convert-external`, method: 'POST', body: { type } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, 'Leads', 'Dashboard'],
    }),
    addNote: build.mutation<ApiEnvelope<unknown>, { id: string; body: string }>({
      query: ({ id, body }) => ({ url: `/leads/${id}/notes`, method: 'POST', body: { body } }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }],
    }),
    scheduleFollowup: build.mutation<ApiEnvelope<unknown>, { id: string; followupDate: string; followupTime?: string; priority: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/leads/${id}/followups`, method: 'POST', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Lead', id }, 'Followup'],
    }),
    assignSingle: build.mutation<ApiEnvelope<unknown>, { leadId: string; assignToId: string }>({
      query: (body) => ({ url: '/leads/assign', method: 'POST', body }),
      invalidatesTags: (_r, _e, { leadId }) => [{ type: 'Lead', id: leadId }, 'Leads', 'Dashboard'],
    }),
    assignBulk: build.mutation<ApiEnvelope<unknown>, { leadIds: string[]; assignToId: string }>({
      query: (body) => ({ url: '/leads/assign/bulk', method: 'POST', body }),
      invalidatesTags: ['Leads', 'Dashboard'],
    }),
    autoAssign: build.mutation<ApiEnvelope<{ distribution: Record<string, number>; total: number }>, { leadIds: string[]; teamId?: string }>({
      query: (body) => ({ url: '/leads/assign/auto', method: 'POST', body }),
      invalidatesTags: ['Leads', 'Dashboard'],
    }),
    // Archive converted leads into the year-tagged Historical store and remove them
    // from active Lead Management. Backend only archives CONVERTED leads (others skipped).
    archiveToHistorical: build.mutation<
      ApiEnvelope<{ archived: number; skipped: number; total: number }>,
      { leadIds: string[]; eventYear: number }
    >({
      query: (body) => ({ url: '/leads/archive-historical', method: 'POST', body }),
      invalidatesTags: ['Leads', 'Dashboard', 'Historical'],
    }),
  }),
});

export const {
  useListLeadsQuery,
  useGetLeadQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useChangeStatusMutation,
  useConvertExternalMutation,
  useAddNoteMutation,
  useScheduleFollowupMutation,
  useAssignSingleMutation,
  useAssignBulkMutation,
  useAutoAssignMutation,
  useArchiveToHistoricalMutation,
} = leadsApi;
