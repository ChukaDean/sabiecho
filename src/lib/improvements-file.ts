import { listExamples, listRecordings, saveExamples, saveRecording, saveReview, type Review } from './db';
import {
  IMPROVEMENTS_FORMAT,
  isReviewsFile,
  REVIEWS_FORMAT,
  verifyImprovements,
  type ImprovementsFile,
  type ReviewsFile,
} from './improvements-format';
import { knownVolunteerCodes, VOLUNTEER_PUBLIC_KEY } from './volunteer';

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

const encodeAudio = async (blob: Blob) => ({ mimeType: blob.type, base64: await blobToBase64(blob) });

export async function exportImprovements(exportedBy: string): Promise<Blob> {
  const [examples, recordings] = await Promise.all([listExamples(), listRecordings()]);
  const file: ImprovementsFile = {
    format: IMPROVEMENTS_FORMAT,
    version: 3,
    exportedAt: Date.now(),
    exportedBy,
    volunteers: knownVolunteerCodes(),
    examples,
    recordings: await Promise.all(
      recordings.filter((r) => r.status !== 'rejected').map(async (r) => ({ ...r, audio: await encodeAudio(r.audio) })),
    ),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function exportReviewsToCheck(reviews: Review[], language: string): Promise<Blob> {
  const file: ReviewsFile = {
    format: REVIEWS_FORMAT,
    version: 1,
    exportedAt: Date.now(),
    language,
    reviews: await Promise.all(
      reviews.map(async (r) => ({ ...r, audio: r.audio ? await encodeAudio(r.audio) : undefined })),
    ),
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export type ImportResult =
  | { kind: 'improvements'; examples: number; recordings: number; rejected: string[] }
  | { kind: 'reviews'; reviews: number };

/** Loads either a volunteer's improvements file or a host's reviews-to-check file. */
export async function importFile(file: Blob): Promise<ImportResult> {
  const raw = JSON.parse(await file.text()) as { format?: string };
  if (isReviewsFile(raw.format)) {
    const data = raw as ReviewsFile;
    const importedAt = Date.now();
    for (const r of data.reviews) {
      await saveReview({ ...r, audio: r.audio ? base64ToBlob(r.audio.base64, r.audio.mimeType) : undefined, importedAt });
    }
    return { kind: 'reviews', reviews: data.reviews.length };
  }
  const { file: data, rejected } = await verifyImprovements(raw, VOLUNTEER_PUBLIC_KEY);
  await saveExamples(data.examples);
  for (const r of data.recordings) await saveRecording({ ...r, audio: base64ToBlob(r.audio.base64, r.audio.mimeType) });
  return { kind: 'improvements', examples: data.examples.length, recordings: data.recordings.length, rejected };
}

/** Uses the phone's share sheet (WhatsApp, email…) when available, otherwise downloads the file. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
    }
  }
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
