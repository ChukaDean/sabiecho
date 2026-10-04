/**
 * Volunteer access codes. The project team signs each code with a private key (scripts/issue-volunteer.ts);
 * the app and the import script check the signature offline with the public key, so a name and its rights
 * cannot be typed in or edited by hand.
 */
export type VolunteerRole = 'correct' | 'record' | 'vet';

export interface VolunteerCredential {
  v: 1;
  id: string;
  name: string;
  /** Local languages this volunteer may record and vet (codes from languages.ts). */
  languages: string[];
  roles: VolunteerRole[];
  issuedAt: number;
  expiresAt: number;
}

const PREFIX = 'EL1';
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGNATURE = { name: 'ECDSA', hash: 'SHA-256' } as const;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signCredential(credential: VolunteerCredential, privateKey: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateKey, ALGORITHM, false, ['sign']);
  const payload = new TextEncoder().encode(JSON.stringify(credential));
  const signature = new Uint8Array(await crypto.subtle.sign(SIGNATURE, key, payload));
  return `${PREFIX}.${toBase64Url(payload)}.${toBase64Url(signature)}`;
}

export class CredentialError extends Error {
  constructor(readonly reason: 'malformed' | 'signature' | 'expired') {
    super(reason);
  }
}

export async function verifyCredential(code: string, publicKey: JsonWebKey, now = Date.now()): Promise<VolunteerCredential> {
  const [prefix, payload, signature] = code.trim().split('.');
  if (prefix !== PREFIX || !payload || !signature) throw new CredentialError('malformed');
  let bytes: Uint8Array<ArrayBuffer>;
  let sig: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64Url(payload);
    sig = fromBase64Url(signature);
  } catch {
    throw new CredentialError('malformed');
  }
  const key = await crypto.subtle.importKey('jwk', publicKey, ALGORITHM, false, ['verify']);
  if (!(await crypto.subtle.verify(SIGNATURE, key, sig, bytes))) throw new CredentialError('signature');
  const credential = JSON.parse(new TextDecoder().decode(bytes)) as VolunteerCredential;
  if (credential.expiresAt < now) throw new CredentialError('expired');
  return credential;
}

export async function generateSigningKeys(): Promise<{ privateKey: JsonWebKey; publicKey: JsonWebKey }> {
  const pair = (await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify'])) as CryptoKeyPair;
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);
  const { kty, crv, x, y } = publicKey;
  return { privateKey, publicKey: { kty, crv, x, y } };
}
