import { useSyncExternalStore } from 'react';
import { verifyCredential, type VolunteerCredential, type VolunteerRole } from './credential';
import publicKey from './volunteer-key.json';

/**
 * The app runs in host mode unless a vetted volunteer signs in with a code issued by the project team.
 * Only volunteers can correct reviews, record or vet voice clips, and retrain.
 */
const CODE_KEY = 'echoloc:volunteer';
/** Every code used on this device, shipped with exports so the team can check who did what. */
const KNOWN_KEY = 'echoloc:volunteer-codes';

let current: { credential: VolunteerCredential; code: string } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const VOLUNTEER_PUBLIC_KEY = publicKey as JsonWebKey;

export async function signIn(code: string): Promise<VolunteerCredential> {
  const credential = await verifyCredential(code, VOLUNTEER_PUBLIC_KEY);
  const trimmed = code.trim();
  localStorage.setItem(CODE_KEY, trimmed);
  localStorage.setItem(KNOWN_KEY, JSON.stringify([...new Set([...knownVolunteerCodes(), trimmed])]));
  current = { credential, code: trimmed };
  emit();
  return credential;
}

export function signOut() {
  localStorage.removeItem(CODE_KEY);
  current = null;
  emit();
}

export function knownVolunteerCodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

const saved = localStorage.getItem(CODE_KEY);
if (saved) void signIn(saved).catch(signOut);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVolunteer() {
  const session = useSyncExternalStore(subscribe, () => current);
  const credential = session?.credential ?? null;
  return {
    credential,
    /** Whether the signed-in volunteer has a role, optionally for a given local language. */
    can: (role: VolunteerRole, language?: string) =>
      !!credential?.roles.includes(role) && (!language || credential.languages.includes(language)),
  };
}
