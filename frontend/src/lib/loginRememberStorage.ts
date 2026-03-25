/**
 * Client-side encrypted storage for "remember email" on the login page.
 * Uses AES-GCM via Web Crypto; key material is derived in-browser (obfuscation, not server-side secrecy).
 */

const STORAGE_REMEMBER = 'muhimmat_login_remember';
/** v2: AES-GCM ciphertext (base64) */
const STORAGE_EMAIL_CIPHER = 'muhimmat_login_email_v2';
/** legacy plaintext — migrated once then removed */
const STORAGE_EMAIL_LEGACY = 'muhimmat_login_email';

const PBKDF2_SALT = new TextEncoder().encode('muhimmat-login-pbkdf2-v1');
const KEY_MATERIAL = new TextEncoder().encode('muhimmat-remember-email-key-v1-static');

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveAesKey(): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', KEY_MATERIAL, { name: 'PBKDF2' }, false, [
    'deriveBits',
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: PBKDF2_SALT, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptRememberedEmail(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey();
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const ct = new Uint8Array(ciphertext);
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv);
  combined.set(ct, iv.length);
  return bytesToBase64(combined);
}

export async function decryptRememberedEmail(b64: string): Promise<string | null> {
  try {
    const combined = base64ToBytes(b64);
    if (combined.length < 13) return null;
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const key = await deriveAesKey();
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(dec);
  } catch (e) {
    console.error('[loginRememberStorage] decrypt failed', e);
    return null;
  }
}

export function getRememberFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_REMEMBER) !== '0';
  } catch (e) {
    console.error('[loginRememberStorage] getRememberFlag failed', e);
    return true;
  }
}

export function setRememberFlag(active: boolean): void {
  try {
    localStorage.setItem(STORAGE_REMEMBER, active ? '1' : '0');
  } catch (e) {
    console.error('[loginRememberStorage] setRememberFlag failed', e);
  }
}

/** Load remembered email: v2 cipher, or migrate legacy plaintext. */
export async function loadRememberedEmail(): Promise<{ email: string | null; remember: boolean }> {
  const remember = getRememberFlag();
  try {
    const cipher = localStorage.getItem(STORAGE_EMAIL_CIPHER);
    if (cipher) {
      const email = await decryptRememberedEmail(cipher);
      return { email: email?.trim() || null, remember };
    }
    const legacy = localStorage.getItem(STORAGE_EMAIL_LEGACY);
    if (legacy?.trim()) {
      const email = legacy.trim();
      try {
        const enc = await encryptRememberedEmail(email);
        localStorage.setItem(STORAGE_EMAIL_CIPHER, enc);
        localStorage.removeItem(STORAGE_EMAIL_LEGACY);
      } catch (e) {
        console.error('[loginRememberStorage] migrate legacy email failed', e);
      }
      return { email, remember };
    }
  } catch (e) {
    console.error('[loginRememberStorage] loadRememberedEmail failed', e);
  }
  return { email: null, remember };
}

export async function persistRememberedEmail(email: string | null, remember: boolean): Promise<void> {
  try {
    setRememberFlag(remember);
    if (remember && email?.trim()) {
      const enc = await encryptRememberedEmail(email.trim());
      localStorage.setItem(STORAGE_EMAIL_CIPHER, enc);
      localStorage.removeItem(STORAGE_EMAIL_LEGACY);
    } else {
      localStorage.removeItem(STORAGE_EMAIL_CIPHER);
      localStorage.removeItem(STORAGE_EMAIL_LEGACY);
    }
  } catch (e) {
    console.error('[loginRememberStorage] persistRememberedEmail failed', e);
  }
}
