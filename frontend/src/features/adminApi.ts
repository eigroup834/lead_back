import { api } from '@/app/api';
import type { ApiEnvelope } from '@/features/types';

export interface FollowupLead {
  id: string;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  designation: string | null;
  country: string | null;
  city: string | null;
  eventName: string | null;
  status: string;
  priority: string;
  assignedUser: { id: string; firstName: string; lastName: string } | null;
}

export interface FollowupRow {
  id: string;
  followupDate: string;
  followupTime: string | null;
  priority: string;
  status: string;
  note: string | null;
  lead?: FollowupLead;
  assignee?: { id: string; firstName: string; lastName: string } | null;
}

export interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: string | null;
  roles: Array<{ role: { id: string; name: string; label: string; level: number } }>;
}

export interface RoleRow {
  id: string;
  name: string;
  label: string;
  level: number;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    listFollowups: build.query<ApiEnvelope<FollowupRow[]>, { scope?: string; days?: number; assigneeId?: string }>({
      query: (params) => ({ url: '/followups', params }),
      providesTags: ['Followup'],
    }),
    followupCounts: build.query<ApiEnvelope<{ overdue: number; today: number; upcoming: number; all: number }>, { assigneeId?: string } | void>({
      query: (params) => ({ url: '/followups/counts', params: params || {} }),
      providesTags: ['Followup'],
    }),
    updateFollowup: build.mutation<ApiEnvelope<unknown>, { id: string; status?: string; followupDate?: string; followupTime?: string; priority?: string; note?: string }>({
      query: ({ id, ...body }) => ({ url: `/followups/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Followup'],
    }),
    listUsers: build.query<ApiEnvelope<UserRow[]>, {
      q?: string; page?: number; limit?: number; sortBy?: string; sortDir?: 'asc' | 'desc';
    } | void>({
      query: (params) => ({ url: '/users', params: params || {} }),
      providesTags: ['User'],
    }),
    listRoles: build.query<ApiEnvelope<RoleRow[]>, void>({ query: () => '/roles', providesTags: ['Role'] }),
    listPermissions: build.query<ApiEnvelope<Array<{ id: string; key: string; module: string }>>, void>({
      query: () => '/roles/permissions/all',
      providesTags: ['Role'],
    }),
    setRolePermissions: build.mutation<ApiEnvelope<unknown>, { id: string; permissionIds: string[] }>({
      query: ({ id, permissionIds }) => ({ url: `/roles/${id}/permissions`, method: 'PATCH', body: { permissionIds } }),
      invalidatesTags: ['Role'],
    }),
    createUser: build.mutation<ApiEnvelope<UserRow>, {
      email: string; phone?: string; password: string; firstName: string; lastName: string; roleIds: string[];
    }>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: build.mutation<ApiEnvelope<UserRow>, {
      id: string; email?: string; phone?: string | null; firstName?: string; lastName?: string;
      roleIds?: string[]; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    }>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    getCredential: build.query<ApiEnvelope<{ password: string | null }>, string>({
      query: (id) => `/users/${id}/credential`,
    }),
    syncLogs: build.query<ApiEnvelope<Array<{
      id: string; status: string; fetchedCount: number; insertedCount: number;
      startedAt: string; finishedAt: string | null; error: string | null;
    }>>, void>({
      query: () => '/sync/logs',
      providesTags: ['Sync'],
    }),
    runSync: build.mutation<ApiEnvelope<{ jobId: string }>, void>({
      query: () => ({ url: '/sync/run', method: 'POST' }),
      invalidatesTags: ['Sync'],
    }),
    listNotifications: build.query<ApiEnvelope<Array<{ id: string; title: string; body: string | null; readAt: string | null; createdAt: string }>>, void>({
      query: () => '/notifications',
      providesTags: ['Notification'],
    }),
    markRead: build.mutation<ApiEnvelope<unknown>, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useListFollowupsQuery,
  useFollowupCountsQuery,
  useUpdateFollowupMutation,
  useListUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useLazyGetCredentialQuery,
  useListRolesQuery,
  useListPermissionsQuery,
  useSetRolePermissionsMutation,
  useSyncLogsQuery,
  useRunSyncMutation,
  useListNotificationsQuery,
  useMarkReadMutation,
} = adminApi;
