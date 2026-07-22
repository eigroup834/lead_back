import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type Mode = 'light' | 'dark';

interface UiState {
  mode: Mode;
  sidebarOpen: boolean;
}

const stored = (localStorage.getItem('themeMode') as Mode) || 'light';

const initialState: UiState = { mode: stored, sidebarOpen: true };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleMode(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', state.mode);
    },
    setMode(state, action: PayloadAction<Mode>) {
      state.mode = action.payload;
      localStorage.setItem('themeMode', state.mode);
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { toggleMode, setMode, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
