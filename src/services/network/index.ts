import request from './request';
import type { AxiosResponse } from 'axios';

export const api = {
  get: <T = unknown>(url: string, params: Record<string, unknown> = {}) =>
    request<T>({ method: 'GET', url, params }),

  post: <T = unknown>(url: string, data: unknown = {}, usePut = false) =>
    request<T>({ method: usePut ? 'PUT' : 'POST', url, data }),

  patch: <T = unknown>(url: string, data: unknown = {}) =>
    request<T>({ method: 'PATCH', url, data }),

  put: <T = unknown>(url: string, data: unknown = {}) =>
    request<T>({ method: 'PUT', url, data }),

  del: <T = unknown>(url: string, data: unknown = {}) =>
    request<T>({ method: 'DELETE', url, data }),

  sendFormData: <T = unknown>(
    url: string,
    formData: unknown,
    usePut = false,
  ): Promise<AxiosResponse<T> | undefined> =>
    request<T>({
      method: usePut ? 'PUT' : 'POST',
      url,
      data: formData,
      isMultipart: true,
    }),
};
