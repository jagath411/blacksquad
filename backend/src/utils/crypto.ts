import crypto from 'crypto';
import { env } from '../config/env';

const ENC_PREFIX = 'enc:v1:';

function resolveKey(): Buffer {
  const raw = env.DATA_ENCRYPTION_KEY;
  if (raw) {
    const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes');
    return key;
  }
  if (env.NODE_ENV === 'production') {
    // eslint-disable-next-line no-console
    console.warn('⚠️ DATA_ENCRYPTION_KEY is not set; deriving it from JWT_SECRET. Set a dedicated key.');
  }
  return crypto.createHash('sha256').update(`blacksquad-data-key:${env.JWT_SECRET}`).digest();
}

const dataKey = resolveKey();

export const sha256 = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export const hmac = (value: string): string =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** Encrypts a field for storage. Already-encrypted and empty values pass through. */
export function encryptField(plain: string | undefined): string | undefined {
  if (!plain || plain.startsWith(ENC_PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${body.toString('base64')}`;
}

/** Decrypts a stored field. Legacy plaintext values are returned as they are. */
export function decryptField(stored: string | undefined): string | undefined {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  const [ivB64, tagB64, bodyB64] = stored.slice(ENC_PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !bodyB64) return undefined;
  const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(bodyB64, 'base64')), decipher.final()]).toString('utf8');
}
