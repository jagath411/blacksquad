import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { UserRole } from '../types';

const TOKEN_KEY = 'blacksquad.accessToken';
const USER_KEY = 'blacksquad.sessionUser';

// In-Memory Storage Fallback (Tier 3)
const inMemoryStore = new Map<string, string>();

let secureStoreSupported: boolean | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (secureStoreSupported !== null) return secureStoreSupported;
  try {
    secureStoreSupported = await SecureStore.isAvailableAsync();
    return secureStoreSupported;
  } catch {
    secureStoreSupported = false;
    return false;
  }
}

/**
 * Tiered Safe Storage Writer
 * Tier 1: expo-secure-store (Native iOS Keychain / Android EncryptedSharedPrefs)
 * Tier 2: window.localStorage (Web Browser)
 * Tier 3: In-Memory Map Fallback
 */
async function setItemSafe(key: string, value: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[Storage] SecureStore setItem failed for ${key}, falling back:`, error);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[Storage] localStorage setItem failed for ${key}, falling back to memory:`, error);
    }
  }

  inMemoryStore.set(key, value);
}

/**
 * Tiered Safe Storage Reader
 */
async function getItemSafe(key: string): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[Storage] SecureStore getItem failed for ${key}:`, error);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[Storage] localStorage getItem failed for ${key}:`, error);
    }
  }

  return inMemoryStore.get(key) ?? null;
}

/**
 * Tiered Safe Storage Remover
 */
async function removeItemSafe(key: string): Promise<void> {
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignore cleanup error
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup error
    }
  }

  inMemoryStore.delete(key);
}

// ----------------------------------------------------------------------------
// Token & Session Storage Public API
// ----------------------------------------------------------------------------

export async function saveAccessToken(token: string): Promise<void> {
  await setItemSafe(TOKEN_KEY, token);
}

export async function getAccessToken(): Promise<string | null> {
  return getItemSafe(TOKEN_KEY);
}

export async function clearAccessToken(): Promise<void> {
  await removeItemSafe(TOKEN_KEY);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function saveSessionUser(user: SessionUser): Promise<void> {
  await setItemSafe(USER_KEY, JSON.stringify(user));
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const raw = await getItemSafe(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function clearSessionUser(): Promise<void> {
  await removeItemSafe(USER_KEY);
}

export async function clearAllStorage(): Promise<void> {
  await Promise.all([clearAccessToken(), clearSessionUser()]);
}
