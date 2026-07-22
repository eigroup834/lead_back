import crypto from 'node:crypto';
import { env } from '@config/env';

export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ---- Reversible password encryption (AES-256-GCM) ----
// Used ONLY for the SUPER_ADMIN "reveal password" feature. The key is derived
// from a server secret; ciphertext is useless without it.
const KEY = crypto.scryptSync(env.PASSWORD_ENC_SECRET, 'exhibitor-pwd-enc', 32);

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv.tag.cipher  (all base64url)
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivB, tagB, dataB] = payload.split('.');
    const iv = Buffer.from(ivB, 'base64url');
    const tag = Buffer.from(tagB, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
