const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const TOKEN_STORAGE_KEY = 'travelerp_token';
export const UNAUTHORIZED_EVENT = 'travelerp:unauthorized';

async function parseError(response: Response): Promise<never> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  const message =
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
      ? data.message
      : `Request failed with status ${response.status}`;

  throw new Error(message);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    return parseError(response);
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  return data as T;
}

export async function downloadBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    return parseError(response);
  }

  return response.blob();
}

export const api = {
  get<T>(path: string) {
    return request<T>('GET', path);
  },
  post<T>(path: string, body: unknown) {
    return request<T>('POST', path, body);
  },
  put<T>(path: string, body: unknown) {
    return request<T>('PUT', path, body);
  },
  delete<T>(path: string) {
    return request<T>('DELETE', path);
  },
};
