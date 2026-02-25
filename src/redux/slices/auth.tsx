import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import request from '../../services/network/request';
import ENDPOINTS from '../../constants/endpoints';

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
  token: string | null;
  isAuthenticated: boolean;
  isFirstLaunch: boolean;
  loading: boolean;
  error: string | null;
  forgotPasswordLoading: boolean;
  forgotPasswordError: string | null;
  verifyOtpLoading: boolean;
  verifyOtpError: string | null;
  resetPasswordLoading: boolean;
  resetPasswordError: string | null;
  /** Token from forgot-password response; used for verify-otp. Replaced by token from verify-otp for reset-password. */
  passwordResetFlowToken: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isFirstLaunch: true,
  loading: false,
  error: null,
  forgotPasswordLoading: false,
  forgotPasswordError: null,
  verifyOtpLoading: false,
  verifyOtpError: null,
  resetPasswordLoading: false,
  resetPasswordError: null,
  passwordResetFlowToken: null,
};

/** API error: message can be string or nested { message, error, statusCode } */
type ApiErrorData = {
  message?: string | { message?: string; error?: string; statusCode?: number };
  error?: string;
  statusCode?: number;
};

function getErrorMessage(
  raw: unknown,
  status?: number,
): string {
  const fallback = 'Login failed';
  if (typeof raw === 'string') {
    if (raw.includes('<') || raw.includes('DOCTYPE')) {
      return status === 404
        ? 'Login service is unavailable. Please try again later.'
        : 'Unable to reach server. Please try again.';
    }
    return raw || fallback;
  }
  if (raw && typeof raw === 'object' && 'message' in raw) {
    const m = (raw as ApiErrorData).message;
    if (typeof m === 'string') return m || fallback;
    if (m && typeof m === 'object' && typeof m.message === 'string') {
      return m.message || fallback;
    }
  }
  return fallback;
}

export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (
    payload: { email?: string; password?: string; [key: string]: unknown },
    { dispatch, rejectWithValue },
  ) => {
    try {
      const response = await request({
        method: 'POST',
        url: ENDPOINTS.AUTH_LOGIN,
        data: payload,
      });
      if (!response?.data) {
        return rejectWithValue('Invalid response');
      }
      const { user, accessToken } = response.data as {
        user?: AuthUser;
        accessToken?: string;
        [key: string]: unknown;
      };
      if (response.status === 200 && accessToken) {
        dispatch(
          setCredentials({
            user: user ?? ({} as AuthUser),
            token: accessToken,
          }),
        );
      }
      return {
        ...response.data,
        status: response.status,
      };
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: ApiErrorData; status?: number };
        message?: string;
      };
      const raw = err?.response?.data ?? err?.message;
      const message = getErrorMessage(raw, err?.response?.status);
      return rejectWithValue(message);
    }
  },
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (payload: { email: string }, { rejectWithValue }) => {
    try {
      const response = await request({
        method: 'POST',
        url: ENDPOINTS.AUTH_FORGOT_PASSWORD,
        data: payload,
      });
      return response?.data ?? {};
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: ApiErrorData; status?: number };
        message?: string;
      };
      const raw = err?.response?.data ?? err?.message;
      const message = getErrorMessage(raw, err?.response?.status);
      return rejectWithValue(message || 'Failed to send verification code.');
    }
  },
);

export const verifyOtpPass = createAsyncThunk(
  'auth/verifyOtpPass',
  async (payload: { otp: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.passwordResetFlowToken;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await request({
        method: 'POST',
        url: ENDPOINTS.AUTH_VERIFY_OTP_PASS,
        data: payload,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      return response?.data ?? {};
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: ApiErrorData; status?: number };
        message?: string;
      };
      const raw = err?.response?.data ?? err?.message;
      const message = getErrorMessage(raw, err?.response?.status);
      return rejectWithValue(message || 'Invalid or expired code.');
    }
  },
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (
    payload: { newPassword: string; confirmPassword: string },
    { getState, rejectWithValue },
  ) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.passwordResetFlowToken;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await request({
        method: 'POST',
        url: ENDPOINTS.AUTH_RESET_PASSWORD,
        data: payload,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      console.log('response--->', JSON.stringify(response, null, 2));
      return response?.data ?? {};
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: ApiErrorData; status?: number };
        message?: string;
      };
      const raw = err?.response?.data ?? err?.message;
      const message = getErrorMessage(raw, err?.response?.status);
      return rejectWithValue(message || 'Failed to reset password.');
    }
  },
);

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
      state.token = token ?? null;
      state.isAuthenticated = true;
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    setIsFirstLaunch: (state, action: PayloadAction<boolean>) => {
      state.isFirstLaunch = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearForgotPasswordError: (state) => {
      state.forgotPasswordError = null;
    },
    clearVerifyOtpError: (state) => {
      state.verifyOtpError = null;
    },
    clearResetPasswordError: (state) => {
      state.resetPasswordError = null;
    },
    clearPasswordResetFlowToken: (state) => {
      state.passwordResetFlowToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string);
      })
      // Forgot password
      .addCase(forgotPassword.pending, (state) => {
        state.forgotPasswordLoading = true;
        state.forgotPasswordError = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = null;
        const data = action.payload as { data?: { token?: string } };
        state.passwordResetFlowToken = data?.data?.token ?? null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.forgotPasswordLoading = false;
        state.forgotPasswordError = (action.payload as string) ?? 'Failed to send code.';
      })
      // Verify OTP
      .addCase(verifyOtpPass.pending, (state) => {
        state.verifyOtpLoading = true;
        state.verifyOtpError = null;
      })
      .addCase(verifyOtpPass.fulfilled, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpError = null;
        const data = action.payload as { data?: { token?: string }; token?: string };
        state.passwordResetFlowToken = data?.data?.token ?? data?.token ?? null;
      })
      .addCase(verifyOtpPass.rejected, (state, action) => {
        state.verifyOtpLoading = false;
        state.verifyOtpError = (action.payload as string) ?? 'Invalid or expired code.';
      })
      // Reset password
      .addCase(resetPassword.pending, (state) => {
        state.resetPasswordLoading = true;
        state.resetPasswordError = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.resetPasswordLoading = false;
        state.resetPasswordError = null;
        state.passwordResetFlowToken = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.resetPasswordLoading = false;
        state.resetPasswordError =
          (action.payload as string) ?? 'Failed to reset password.';
      });
  },
});

export const {
  setCredentials,
  logout,
  setIsFirstLaunch,
  clearError,
  clearForgotPasswordError,
  clearVerifyOtpError,
  clearResetPasswordError,
  clearPasswordResetFlowToken,
} = authSlice.actions;

export default authSlice.reducer;
