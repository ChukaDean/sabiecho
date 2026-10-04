import { verifyCredential, type VolunteerCredential, type VolunteerRole } from './credential';
import type { Review, TrainingExample, VoiceRecording } from './db';

export const IMPROVEMENTS_FORMAT = 'sabiecho-improvements';
export const REVIEWS_FORMAT = 'sabiecho-reviews';
/** Files exported before the project was renamed from EchoLoc. */
const LEGACY_IMPROVEMENTS_FORMAT = 'echoloc-improvements';
const LEGACY_REVIEWS_FORMAT = 'echoloc-reviews';

export const isReviewsFile = (format: unknown) => format === REVIEWS_FORMAT || format === LEGACY_REVIEWS_FORMAT;
const isImprovementsFile = (format: unknown) =>
  format === IMPROVEMENTS_FORMAT || format === LEGACY_IMPROVEMENTS_FORMAT;

type SharedAudio = { mimeType: string; base64: string };
export type SharedRecording = Omit<VoiceRecording, 'audio'> & { audio: SharedAudio };
export type SharedReview = Omit<Review, 'audio'> & { audio?: SharedAudio };

/** One file that carries a volunteer device's examples and voice recordings to another device or to the team. */
export interface ImprovementsFile {
  format: typeof IMPROVEMENTS_FORMAT;
  version: 3;
  exportedAt: number;
  exportedBy: string;
  /** Signed access codes of everyone who corrected, recorded or vetted on the exporting device. */
  volunteers: string[];
  examples: TrainingExample[];
  recordings: SharedRecording[];
}

/** Reviews a host sends to volunteers because SabiEcho was unsure or the host flagged them. */
export interface ReviewsFile {
  format: typeof REVIEWS_FORMAT;
  version: 1;
  exportedAt: number;
  /** The local language the host's device speaks. */
  language: string;
  reviews: SharedReview[];
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Keeps only work done by vetted volunteers with the right role and language: examples need "correct",
 * recordings need "record", approvals need "vet" by someone other than the recorder.
 */
export async function verifyImprovements(
  raw: unknown,
  publicKey: JsonWebKey,
): Promise<{ file: ImprovementsFile; rejected: string[] }> {
  const data = raw as Partial<ImprovementsFile> & { format?: string };
  if (!isImprovementsFile(data?.format)) throw new Error('Not a SabiEcho improvements file');
  const volunteers: VolunteerCredential[] = [];
  const rejected: string[] = [];
  for (const code of data.volunteers ?? []) {
    try {
      volunteers.push(await verifyCredential(code, publicKey, data.exportedAt));
    } catch (e) {
      rejected.push(`access code rejected (${e instanceof Error ? e.message : e})`);
    }
  }
  const allowed = (name: string | undefined, role: VolunteerRole, language?: string) =>
    !!name &&
    volunteers.some(
      (v) => sameName(v.name, name) && v.roles.includes(role) && (!language || v.languages.includes(language)),
    );

  const examples = (data.examples ?? []).filter((e) => {
    if (allowed(e.by, 'correct')) return true;
    rejected.push(`example "${e.text}" by ${e.by ?? 'unknown'}: not a vetted language reviewer`);
    return false;
  });
  const recordings: SharedRecording[] = [];
  for (const r of data.recordings ?? []) {
    const label = `${r.language} #${r.meaningId} by ${r.recordedBy}`;
    if (!allowed(r.recordedBy, 'record', r.language)) {
      rejected.push(`recording ${label}: recorder not vetted for this language`);
    } else if (r.status === 'approved' && (!allowed(r.vettedBy, 'vet', r.language) || sameName(r.vettedBy!, r.recordedBy))) {
      recordings.push({ ...r, status: 'pending', vettedBy: undefined, vettedAt: undefined });
      rejected.push(`approval of ${label} by ${r.vettedBy}: not a second vetted speaker, kept as pending`);
    } else {
      recordings.push(r);
    }
  }
  return {
    file: { ...(data as ImprovementsFile), format: IMPROVEMENTS_FORMAT, version: 3, volunteers: data.volunteers ?? [], examples, recordings },
    rejected,
  };
}
