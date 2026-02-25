import type { AxiosResponse } from 'axios';
import apiClient from './apiClient';
import checkNetwork from '../../utils/checkNetwork';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  isMultipart?: boolean;
  headers?: Record<string, string>;
}

const request = async <T = unknown>({
  method = 'GET',
  url,
  data = null,
  params = {},
  isMultipart = false,
  headers: customHeaders,
}: RequestOptions): Promise<AxiosResponse<T> | undefined> => {
  try {
    const isOnline = await checkNetwork();

    if (!isOnline) {
      console.log('You are offline. Please check your internet connection.');
      return;
    }
    const headers: Record<string, string> = { ...customHeaders };
    if (isMultipart) headers['Content-Type'] = 'multipart/form-data';

    const config = {
      method,
      url,
      headers,
      ...(data != null && { data }),
      ...(params != null && { params }),
    };

    const response = await apiClient(config);
    return response;
  } catch (error: unknown) {
    console.log('error', error);
    const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
    const errorMessage =
      err?.response?.data?.error ??
      err?.response?.data?.message ??
      err?.message ??
      'Something went wrong! Please try again later.';

    // later add a toast message
    console.log('errorMessage', JSON.stringify(errorMessage, null, 2));

    throw error;
  }
};

export default request;
