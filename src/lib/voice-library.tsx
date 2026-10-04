import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listRecordings, type VoiceRecording } from './db';
import { useI18n } from '../i18n';
import { DEFAULT_LANGUAGE, getLanguage, languageName, type LocalLanguage } from './languages';
import builtInRecordings from './recordings.json';
import { MEANINGS, type MeaningId } from './taxonomy';
import { voicePack } from './voice-pack';

export interface VoiceClip {
  text: string | null;
  url: string;
  /** True when the clip was recorded and vetted on this device rather than shipped with the app. */
  local: boolean;
}

interface VoiceLibrary {
  /** The local language this device plays messages in. */
  language: LocalLanguage;
  setLanguage(code: string): void;
  clip(id: MeaningId, language?: string): VoiceClip | null;
  /** The written message in a language, which may exist before anyone has recorded it. */
  text(id: MeaningId, language?: string): string | null;
  /** How many of the 27 messages have a playable clip in a language. */
  coverage(language: string): number;
  recordings: VoiceRecording[];
  refresh(): Promise<void>;
}

const BUILT_IN = builtInRecordings as Record<string, Partial<Record<string, { text: string; audio?: string }>>>;
const LANGUAGE_KEY = 'echoloc:local-language';

const Context = createContext<VoiceLibrary | null>(null);

/** Shipped clips, overridden per language by the most recently approved recording made on this device. */
export function VoiceLibraryProvider({ children }: { children: ReactNode }) {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [languageCode, setLanguageCode] = useState(() => localStorage.getItem(LANGUAGE_KEY) ?? DEFAULT_LANGUAGE);

  const refresh = useCallback(async () => setRecordings(await listRecordings()), []);
  useEffect(() => void refresh(), [refresh]);

  const setLanguage = useCallback((code: string) => {
    localStorage.setItem(LANGUAGE_KEY, code);
    setLanguageCode(code);
  }, []);

  const localClips = useMemo(() => {
    const latest = new Map<string, VoiceRecording>();
    for (const r of recordings) {
      if (r.status !== 'approved') continue;
      const key = `${r.language}:${r.meaningId}`;
      const current = latest.get(key);
      if (!current || (r.vettedAt ?? 0) > (current.vettedAt ?? 0)) latest.set(key, r);
    }
    return new Map([...latest].map(([key, r]) => [key, { text: r.text || null, url: URL.createObjectURL(r.audio) }]));
  }, [recordings]);
  useEffect(() => () => localClips.forEach((c) => URL.revokeObjectURL(c.url)), [localClips]);

  const language = getLanguage(languageCode);

  useEffect(() => {
    const save = () =>
      void voicePack.check(language.code).then((s) => {
        if (s.status !== 'ready' && s.total > 0 && navigator.onLine) void voicePack.download(language.code);
      });
    save();
    window.addEventListener('online', save);
    return () => window.removeEventListener('online', save);
  }, [language.code]);

  const clip = useCallback(
    (id: MeaningId, code = language.code): VoiceClip | null => {
      const local = localClips.get(`${code}:${id}`);
      if (local) return { ...local, local: true };
      const shipped = BUILT_IN[code]?.[id];
      return shipped?.audio
        ? { text: shipped.text || null, url: `${import.meta.env.BASE_URL}${shipped.audio}`, local: false }
        : null;
    },
    [localClips, language.code],
  );

  const text = useCallback(
    (id: MeaningId, code = language.code) => clip(id, code)?.text ?? (BUILT_IN[code]?.[id]?.text || null),
    [clip, language.code],
  );

  const coverage = useCallback((code: string) => MEANINGS.filter((m) => clip(m.id, code)).length, [clip]);

  const value = useMemo(
    () => ({ language, setLanguage, clip, text, coverage, recordings, refresh }),
    [language, setLanguage, clip, text, coverage, recordings, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useVoices() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useVoices must be used inside VoiceLibraryProvider');
  return ctx;
}

/** Name of a local language (the selected one by default) for use inside a UI sentence. */
export function useLanguageName(code?: string) {
  const { lang } = useI18n();
  const { language } = useVoices();
  return languageName(code ? getLanguage(code) : language, lang);
}


