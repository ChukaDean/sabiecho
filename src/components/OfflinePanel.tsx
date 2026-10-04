import { useEffect, useState } from 'react';
import { useI18n, type StringKey } from '../i18n';
import { ml, type ModelState } from '../lib/ml';
import { ASR_MODEL, EMBEDDING_MODEL } from '../lib/models';
import { useLanguageName, useVoices } from '../lib/voice-library';
import { packSizeMB, voicePack, type VoicePackState } from '../lib/voice-pack';
import type { ModelKey } from '../lib/worker-protocol';
import { ScreenHero } from './ScreenHero';

const MODELS: { key: ModelKey; label: StringKey; mb: number; id: string }[] = [
  { key: 'embedder', label: 'modelEmbedder', mb: EMBEDDING_MODEL.approxMB, id: EMBEDDING_MODEL.id },
  { key: 'asr', label: 'modelAsr', mb: ASR_MODEL.approxMB, id: ASR_MODEL.id },
];

export function OfflinePanel() {
  const { t } = useI18n();
  const { language } = useVoices();
  const [states, setStates] = useState({ ...ml.states });
  const [pack, setPack] = useState<VoicePackState>(() => voicePack.state(language.code));
  useEffect(() => ml.subscribe((m, s) => setStates((prev) => ({ ...prev, [m]: s }))), []);
  useEffect(() => {
    setPack(voicePack.state(language.code));
    void voicePack.check(language.code).then(setPack);
    return voicePack.subscribe((code, s) => code === language.code && setPack(s));
  }, [language.code]);

  const hasPack = pack.total > 0;
  const modelsReady = MODELS.filter((m) => states[m.key].status === 'ready' || ml.wasDownloaded(m.key)).length;
  const ready = modelsReady + (hasPack && pack.status === 'ready' ? 1 : 0);
  const total = MODELS.length + (hasPack ? 1 : 0);
  return (
    <section className="panel">
      <ScreenHero
        eyebrow={t('offlineEyebrow')}
        title={t('offlineTitle')}
        intro={t('offlineIntro')}
        stat={{ value: ready, label: t('offlineStat', { total }) }}
        progress={ready / total}
      />
      <ul className="models">
        <VoicePackRow pack={pack} code={language.code} />
        {MODELS.map((m) => (
          <li key={m.key} className="model">
            <div>
              <div className="model-name">{t(m.label)}</div>
              <div className="model-id">
                {m.id} · ~{m.mb} MB
              </div>
            </div>
            <ModelStatus state={states[m.key]} downloadedBefore={ml.wasDownloaded(m.key)} onLoad={() => ml.load(m.key).catch(() => {})} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function VoicePackRow({ pack, code }: { pack: VoicePackState; code: string }) {
  const { t } = useI18n();
  const languageName = useLanguageName();
  return (
    <li className="model">
      <div>
        <div className="model-name">{t('voicePackName', { language: languageName })}</div>
        <div className="model-id">
          {pack.total > 0
            ? t('voicePackDetail', { n: pack.total, mb: packSizeMB(code) })
            : t('voicePackNone', { language: languageName })}
        </div>
      </div>
      {pack.total > 0 && <VoicePackStatus pack={pack} onDownload={() => void voicePack.download(code)} />}
    </li>
  );
}

function VoicePackStatus({ pack, onDownload }: { pack: VoicePackState; onDownload: () => void }) {
  const { t } = useI18n();
  switch (pack.status) {
    case 'ready':
      return <span className="status ok">✓ {t('downloaded')}</span>;
    case 'downloading': {
      const pct = Math.round((pack.done / pack.total) * 100);
      return (
        <span className="status">
          {t('downloading')} {pct}%
          <progress value={pct} max={100} />
        </span>
      );
    }
    case 'error':
      return (
        <span className="status err">
          {t('error')}{' '}
          <button className="secondary" onClick={onDownload}>
            {t('retry')}
          </button>
        </span>
      );
    default:
      return (
        <button className="secondary" onClick={onDownload}>
          {t('download')} · {t('notDownloaded')}
        </button>
      );
  }
}

function ModelStatus({ state, downloadedBefore, onLoad }: { state: ModelState; downloadedBefore: boolean; onLoad: () => void }) {
  const { t } = useI18n();
  switch (state.status) {
    case 'ready':
      return <span className="status ok">✓ {t('downloaded')}</span>;
    case 'loading': {
      const pct = state.total ? Math.round((state.loaded / state.total) * 100) : null;
      return (
        <span className="status">
          {pct !== null ? `${t('downloading')} ${pct}%` : t('loadingModel')}
          {pct !== null && <progress value={pct} max={100} />}
        </span>
      );
    }
    case 'error':
      return (
        <span className="status err">
          {t('error')}: {state.error}{' '}
          <button className="secondary" onClick={onLoad}>
            {t('retry')}
          </button>
        </span>
      );
    default:
      return downloadedBefore ? (
        <span className="status ok">✓ {t('downloaded')}</span>
      ) : (
        <button className="secondary" onClick={onLoad}>
          {t('download')} · {t('notDownloaded')}
        </button>
      );
  }
}
