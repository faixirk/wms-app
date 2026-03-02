import { Alert } from 'react-native';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

/** Prevents showing multiple 401 alerts when several requests fail at once. */
let unauthenticatedAlertShown = false;

const apiClient = axios.create({
  baseURL: 'https://api.wms365.ai',
  timeout: 20000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

axiosRetry(apiClient, {
  retries: 3,
  retryDelay: (retryCount: number) => Math.pow(2, retryCount) * 1000,
  retryCondition: (error: AxiosError) => {
    const method = error.config?.method?.toUpperCase() ?? '';
    const isIdempotent = ['GET', 'HEAD', 'OPTIONS'].includes(method);
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response != null && error.response.status >= 500 && isIdempotent)
    );
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const { store } = require('../../redux/store') as { store: { getState: () => unknown } };
      const state = store.getState() as { auth?: { user?: { token?: string; data?: { token?: string } } } };
      const user = state?.auth?.user;
      const token =
        user?.token ??
        user?.data?.token ??
        (user?.data != null && typeof user.data === 'object' && user.data.token);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Only log warning if it's a known protected route to avoid log spam, 
        // or just rely on the server returning 401.
        // console.warn('No token found for protected API request:', config.url);
      }
    } catch (error) {
      console.warn('Failed to get token from store:', error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? error.config?.baseURL ?? '';
    const path = typeof requestUrl === 'string' ? requestUrl : '';
    const isAuthEndpoint = /\/auth\/?/.test(path);
    const isSessionExpired =
      status === 401 && !isAuthEndpoint;

    if (error.response) {
      console.log('Error Response:', JSON.stringify(error.response, null, 2));
    } else if (error.request) {
      console.log(
        'No Response Received:',
        JSON.stringify(error.request) ?? error.message,
      );
    } else {
      console.log('Request Setup Error:', error.message);
    }

    if (isSessionExpired && !unauthenticatedAlertShown) {
      unauthenticatedAlertShown = true;
      const message =
        (error.response?.data as { message?: string | { message?: string } } | undefined)?.message;
      const displayMessage =
        typeof message === 'string'
          ? message
          : typeof message === 'object' && message?.message
            ? message.message
            : 'Your session has expired or you are not authorized.';
      Alert.alert(
        'Session Expired',
        `${displayMessage} Please log out and log in again.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              unauthenticatedAlertShown = false;
            },
          },
          {
            text: 'Log out',
            style: 'destructive',
            onPress: () => {
              unauthenticatedAlertShown = false;
              try {
                const { store } = require('../../redux/store') as {
                  store: { dispatch: (action: { type: string }) => void };
                };
                store.dispatch({ type: 'auth/logout' });
              } catch (e) {
                console.warn('Failed to dispatch logout on 401:', e);
              }
            },
          },
        ],
        { cancelable: false },
      );
    }

    return Promise.reject(error);
  },
);

export default apiClient;
