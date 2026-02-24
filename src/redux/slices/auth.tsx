import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  token?: string;
  data?: {
    token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; token?: string }>,
    ) => {
      const { user, token } = action.payload;
      state.user = {
        ...user,
        token: token ?? user?.token ?? user?.data?.token,
        data: { ...user?.data, token: token ?? user?.token ?? user?.data?.token },
      };
      state.isAuthenticated = true;
      state.error = null;
    },
    setToken: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.token = action.payload;
        if (state.user.data) {
          state.user.data.token = action.payload;
        }
      }
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setCredentials,
  setToken,
  logout,
  setLoading,
  setError,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
