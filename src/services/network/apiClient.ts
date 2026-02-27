import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

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
    return Promise.reject(error);
  },
);

export default apiClient;
