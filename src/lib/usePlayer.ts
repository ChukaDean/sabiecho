import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoices } from './voice-library';
import type { MeaningId } from './taxonomy';

/** Plays the recorded local-language clips for the given meanings one after another. */
export function usePlayer() {
  const { clip } = useVoices();
  const [playing, setPlaying] = useState<MeaningId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<{ id: MeaningId; url: string }[]>([]);

  const stop = useCallback(() => {
    queueRef.current = [];
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }, []);

  const next = useCallback(() => {
    const item = queueRef.current.shift();
    if (!item) {
      audioRef.current = null;
      setPlaying(null);
      return;
    }
    const audio = new Audio(item.url);
    audioRef.current = audio;
    setPlaying(item.id);
    audio.onended = next;
    audio.onerror = next;
    void audio.play().catch(next);
  }, []);

  const play = useCallback(
    (ids: MeaningId[]) => {
      stop();
      queueRef.current = ids.flatMap((id) => {
        const c = clip(id);
        return c ? [{ id, url: c.url }] : [];
      });
      next();
    },
    [clip, next, stop],
  );

  useEffect(() => stop, [stop]);

  return { play, stop, playing };
}
