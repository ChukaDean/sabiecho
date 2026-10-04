import { useI18n } from '../i18n';
import { MEANINGS } from '../lib/taxonomy';

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** Only offer the overall feelings (1–3) plus "none". */
  overallOnly?: boolean;
  label?: string;
}

/** Picks one of the meanings SabiEcho can be trained on; 0 means none of them. */
export function MeaningSelect({ value, onChange, overallOnly, label }: Props) {
  const { lang, t } = useI18n();
  const text = (m: (typeof MEANINGS)[number]) => `${m.id}. ${lang === 'fr' ? m.fr : m.en}`;
  return (
    <select className="meaning-select" value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      <option value={0}>{overallOnly ? t('noOverall') : t('noneOfThese')}</option>
      <optgroup label={t('groupOverall')}>
        {MEANINGS.filter((m) => m.group === 'overall').map((m) => (
          <option key={m.id} value={m.id}>
            {text(m)}
          </option>
        ))}
      </optgroup>
      {!overallOnly && (
        <optgroup label={t('groupTopics')}>
          {MEANINGS.filter((m) => m.group !== 'overall' && m.group !== 'fallback').map((m) => (
            <option key={m.id} value={m.id}>
              {text(m)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
