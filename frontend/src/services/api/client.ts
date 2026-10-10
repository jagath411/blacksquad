import { clearAllStorage, getAccessToken, getRefreshToken, saveSession, type SessionUser } from '../tokenStore';
import { emitSessionExpired } from '../session';

function getBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  // Web build served by the backend itself: use the same origin.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  throw new Error('EXPO_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env and set it.');
}

const API_BASE_URL = getBaseUrl();

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Sign-in endpoints answer 401 for bad credentials; those must not trigger a token refresh.
const isCredentialEndpoint = (path: string) => path.startsWith('/auth/') && !path.startsWith('/auth/me');

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Swaps the stored refresh token for a new pair. Concurrent callers share one request.
 * Returns false (and signs the user out) when the session cannot be renewed.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (res.ok) {
          const body = (await res.json()) as { accessToken: string; refreshToken: string; user: SessionUser };
          await saveSession(body);
          return true;
        }
        if (res.status === 401 || res.status === 400) {
          await clearAllStorage();
          emitSessionExpired();
        }
        return false;
      } catch {
        // Offline: keep the session and let the caller retry later.
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function send(path: string, init: RequestInit | undefined): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Please check your network connection.');
  }
}

export async function apiRequest<T>(rawPath: string, init?: RequestInit): Promise<T> {
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  let response = await send(path, init);

  if (response.status === 401 && !isCredentialEndpoint(path) && (await refreshSession())) {
    response = await send(path, init);
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
