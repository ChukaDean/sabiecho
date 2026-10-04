import type { ReactNode } from 'react';

const RING_RADII = [96, 74, 52, 32];

interface Props {
  eyebrow: string;
  title: string;
  intro?: string;
  stat?: { value: number | string; label: string };
  /** Share of something done (0–1), drawn as a thin line under the stat. */
  progress?: number;
  children?: ReactNode;
}

/** The navy band at the top of every screen, with the sound rings from the brand cover. */
export function ScreenHero({ eyebrow, title, intro, stat, progress, children }: Props) {
  return (
    <header className="screen-hero">
      <svg className="hero-rings" viewBox="0 0 200 200" aria-hidden="true">
        {RING_RADII.map((r) => (
          <circle key={r} cx="100" cy="100" r={r} />
        ))}
        <circle className="hero-dot" cx="100" cy="100" r="13" />
      </svg>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {intro && <p className="hero-intro">{intro}</p>}
      {stat && (
        <div className="hero-stat">
          <span className="hero-num">{stat.value}</span>
          <span>{stat.label}</span>
        </div>
      )}
      {progress !== undefined && (
        <div className="hero-progress">
          <span style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }} />
        </div>
      )}
      {children && <div className="hero-actions">{children}</div>}
    </header>
  );
}
