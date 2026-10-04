/**
 * Issues a signed volunteer access code. Only the project team runs this; the private key never ships.
 *
 *   npm run issue-volunteer -- --name "Afi Houngbo" --languages fon,wol [--roles correct,record,vet] [--days 365]
 *
 * The first run creates keys/volunteer-signing-key.json (keep it secret and backed up) and writes the public
 * key into src/lib/volunteer-key.json. Replacing the key invalidates every code issued before.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { generateSigningKeys, signCredential, type VolunteerRole } from '../src/lib/credential';
import { LANGUAGES_BY_CODE } from '../src/lib/languages';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    languages: { type: 'string' },
    roles: { type: 'string', default: 'correct,record,vet' },
    days: { type: 'string', default: '365' },
  },
});

const root = new URL('../', import.meta.url);
const PRIVATE_KEY = new URL('keys/volunteer-signing-key.json', root);
const PUBLIC_KEY = new URL('src/lib/volunteer-key.json', root);

if (!existsSync(PRIVATE_KEY)) {
  const { privateKey, publicKey } = await generateSigningKeys();
  mkdirSync(new URL('keys/', root), { recursive: true });
  writeFileSync(PRIVATE_KEY, JSON.stringify(privateKey, null, 2));
  writeFileSync(PUBLIC_KEY, `${JSON.stringify(publicKey, null, 2)}\n`);
  console.error('Created a new signing key in keys/ and updated src/lib/volunteer-key.json; rebuild the app.');
}

const name = values.name?.trim();
const languages = (values.languages ?? '').split(',').map((l) => l.trim()).filter(Boolean);
const roles = values.roles.split(',').map((r) => r.trim()) as VolunteerRole[];
if (!name || languages.length === 0) {
  console.error('Usage: npm run issue-volunteer -- --name "Full Name" --languages fon,wol [--roles correct,record,vet] [--days 365]');
  process.exit(1);
}
const unknown = languages.filter((l) => !LANGUAGES_BY_CODE.has(l));
if (unknown.length) throw new Error(`Unknown language code(s): ${unknown.join(', ')}`);
if (roles.some((r) => !['correct', 'record', 'vet'].includes(r))) throw new Error('Roles are correct, record, vet');

const now = Date.now();
const code = await signCredential(
  { v: 1, id: crypto.randomUUID(), name, languages, roles, issuedAt: now, expiresAt: now + Number(values.days) * 86_400_000 },
  JSON.parse(readFileSync(PRIVATE_KEY, 'utf8')) as JsonWebKey,
);
console.log(code);
