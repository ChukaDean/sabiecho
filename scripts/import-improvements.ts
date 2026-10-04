/**
 * Merges files exported from volunteers' Improve tab into the shipped project. Only work done by volunteers with
 * a valid signed access code (and the right role and language) is accepted:
 *   - examples go into data/train.json (then run `npm run train`)
 *   - approved recordings go into public/audio/<language>/ and src/lib/recordings.json
 *
 * Usage: npm run import-improvements -- path/to/sabiecho-improvements-*.json [...]
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { verifyImprovements, type ImprovementsFile } from '../src/lib/improvements-format';
import { LANGUAGES_BY_CODE } from '../src/lib/languages';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run import-improvements -- <exported file> [...]');
  process.exit(1);
}

const root = new URL('../', import.meta.url);
const TRAIN = new URL('data/train.json', root);
const TEST = new URL('data/test.json', root);
const MANIFEST = new URL('src/lib/recordings.json', root);

const normalize = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const train = JSON.parse(readFileSync(TRAIN, 'utf8')) as Record<string, string[]>;
const testTexts = new Set((JSON.parse(readFileSync(TEST, 'utf8')) as { text: string }[]).map((c) => normalize(c.text)));
const known = new Map<string, number>();
for (const [label, texts] of Object.entries(train)) for (const text of texts) known.set(normalize(text), Number(label));

type Recording = ImprovementsFile['recordings'][number];
/** Keyed by `${language}:${meaningId}`. */
const latestApproved = new Map<string, Recording>();
let added = 0;
let duplicates = 0;
const conflicts: string[] = [];
const heldOut: string[] = [];
const skippedRecordings: string[] = [];
const unverified: string[] = [];

for (const file of files) {
  const publicKey = JSON.parse(readFileSync(new URL('src/lib/volunteer-key.json', root), 'utf8')) as JsonWebKey;
  const { file: data, rejected } = await verifyImprovements(JSON.parse(readFileSync(file, 'utf8')), publicKey);
  for (const reason of rejected) unverified.push(`${file}: ${reason}`);

  for (const e of data.examples) {
    const key = normalize(e.text);
    if (testTexts.has(key)) {
      heldOut.push(e.text);
      continue;
    }
    const existing = known.get(key);
    if (existing === e.label) {
      duplicates++;
      continue;
    }
    if (existing !== undefined) {
      conflicts.push(`"${e.text}": already ${existing}, file says ${e.label} (by ${e.by ?? '?'})`);
      continue;
    }
    (train[String(e.label)] ??= []).push(e.text.trim());
    known.set(key, e.label);
    added++;
  }

  for (const r of data.recordings) {
    const label = `${r.language} #${r.meaningId} by ${r.recordedBy}`;
    if (!LANGUAGES_BY_CODE.has(r.language)) {
      skippedRecordings.push(`${label}: unknown language`);
      continue;
    }
    if (r.status !== 'approved') {
      skippedRecordings.push(`${label}: ${r.status}`);
      continue;
    }
    if (!r.vettedBy || normalize(r.vettedBy) === normalize(r.recordedBy)) {
      skippedRecordings.push(`${label}: not vetted by a second person`);
      continue;
    }
    const key = `${r.language}:${r.meaningId}`;
    const current = latestApproved.get(key);
    if (!current || (r.vettedAt ?? 0) > (current.vettedAt ?? 0)) latestApproved.set(key, r);
  }
}

writeFileSync(TRAIN, `${JSON.stringify(train, null, 2)}\n`);

const EXTENSIONS: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};
type Manifest = Record<string, Record<string, { text: string; audio: string }>>;
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
for (const r of latestApproved.values()) {
  const ext = EXTENSIONS[r.audio.mimeType.split(';')[0]] ?? 'webm';
  const dir = new URL(`public/audio/${r.language}/`, root);
  mkdirSync(dir, { recursive: true });
  const audio = `audio/${r.language}/${String(r.meaningId).padStart(2, '0')}.${ext}`;
  const entries = (manifest[r.language] ??= {});
  const previous = entries[r.meaningId]?.audio;
  if (previous && previous !== audio && existsSync(new URL(`public/${previous}`, root))) {
    unlinkSync(new URL(`public/${previous}`, root));
  }
  writeFileSync(new URL(`public/${audio}`, root), Buffer.from(r.audio.base64, 'base64'));
  entries[r.meaningId] = { text: r.text || entries[r.meaningId]?.text || '', audio };
  console.log(`${r.language} #${r.meaningId}: ${audio} (recorded by ${r.recordedBy}, approved by ${r.vettedBy})`);
}
const sorted = Object.fromEntries(
  Object.entries(manifest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, entries]) => [code, Object.fromEntries(Object.entries(entries).sort(([a], [b]) => Number(a) - Number(b)))]),
);
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(`\nExamples: ${added} added, ${duplicates} already present, ${conflicts.length} conflicting, ${heldOut.length} skipped (in test set).`);
for (const c of conflicts) console.log(`  conflict ${c}`);
for (const h of heldOut) console.log(`  test-set text skipped: "${h}"`);
for (const s of skippedRecordings) console.log(`  recording skipped ${s}`);
if (unverified.length) console.log(`\nNot from vetted volunteers (${unverified.length}):`);
for (const u of unverified) console.log(`  ${u}`);
console.log(`Recordings updated: ${latestApproved.size}.`);
if (added) console.log('\nNext: npm run train && npm run benchmark -- trained');
