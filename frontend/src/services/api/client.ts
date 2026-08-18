import { getAccessToken } from '../tokenStore';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://65.2.202.84:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': '69420',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };

  let response: Response;
  try {
    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (netErr) {
    throw new ApiError(0, 'Unable to reach the server. Please check your network connection.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      if (response.status === 402) {
        message = 'Server tunnel limit reached or authentication required.';
      } else if (response.status === 401) {
        message = 'Authentication required. Please sign in again.';
      } else if (response.status === 404) {
        message = 'Requested service endpoint was not found.';
      }
    }
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export { API_BASE_URL };
