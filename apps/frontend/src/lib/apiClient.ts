import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

/**
 * Access token mantido só em memória (nunca localStorage) — o refresh token
 * vive num cookie httpOnly setado pelo backend (ADR-009). `withCredentials`
 * garante que esse cookie viaje em toda chamada, inclusive no /auth/refresh.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const response = await axios.post<{ accessToken: string }>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  setAccessToken(response.data.accessToken);
  return response.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !isAuthEndpoint) {
      try {
        refreshInFlight ??= refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
        const newToken = await refreshInFlight;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(original);
      } catch (refreshError) {
        setAccessToken(null);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
