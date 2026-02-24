import type { AxiosInstance, AxiosError } from 'axios';

declare module 'axios-retry' {
  interface AxiosRetry {
    (axios: AxiosInstance, options?: {
      retries?: number;
      retryDelay?: (retryCount: number) => number;
      retryCondition?: (error: AxiosError) => boolean;
    }): void;
    isNetworkOrIdempotentRequestError(error: AxiosError): boolean;
  }
  const axiosRetry: AxiosRetry;
  export default axiosRetry;
}
