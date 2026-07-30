import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  level: number;
  roles: string[];
  permissions: string[];
  departmentId: string | null;
  teamId: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  initialized: boolean; 
}

const initialState: AuthState = { accessToken: null, user: null, initialized: false };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
    setInitialized(state) {
      state.initialized = true;
    },
    logout(state) {
      state.accessToken = null;
      state.user = null;
    },
  },
});

export const { setCredentials, setInitialized, logout } = authSlice.actions;
export default authSlice.reducer;
