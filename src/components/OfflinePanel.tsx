import { useEffect, useState } from 'react';
import { useI18n, type StringKey } from '../i18n';
import { ml, type ModelState } from '../lib/ml';
import { ASR_MODEL, EMBEDDING_MODEL } from '../lib/models';
import type { ModelKey } from '../lib/worker-protocol';
import { ScreenHero } from './ScreenHero';

const MODELS: { key: ModelKey; label: StringKey; mb: number; id: string }[] = [
  { key: 'embedder', label: 'modelEmbedder', mb: EMBEDDING_MODEL.approxMB, id: EMBEDDING_MODEL.id },
  { key: 'asr', label: 'modelAsr', mb: ASR_MODEL.approxMB, id: ASR_MODEL.id },
];

export function OfflinePanel() {
  const { t } = useI18n();
  const [states, setStates] = useState({ ...ml.states });
  useEffect(() => ml.subscribe((m, s) => setStates((prev) => ({ ...prev, [m]: s }))), []);

  const ready = MODELS.filter((m) => states[m.key].status === 'ready' || ml.wasDownloaded(m.key)).length;
  return (
    <section className="panel">
      <ScreenHero
        eyebrow={t('offlineEyebrow')}
        title={t('offlineTitle')}
        intro={t('offlineIntro')}
        stat={{ value: ready, label: t('offlineStat') }}
        progress={ready / MODELS.length}
      />
      <ul className="models">
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
