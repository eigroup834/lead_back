import { api } from '@/app/api';
import type { ApiEnvelope } from '@/features/types';
import type { AuthUser } from './authSlice';

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<ApiEnvelope<LoginResponse>, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    logout: build.mutation<ApiEnvelope<{ loggedOut: boolean }>, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
    }),
    me: build.query<ApiEnvelope<{ user: AuthUser }>, void>({
      query: () => '/auth/me',
    }),
  }),
});

export const { useLoginMutation, useLogoutMutation, useMeQuery } = authApi;
