export type TargetKind = 'orb' | 'precision' | 'comet' | 'hazard';

export interface ArenaTarget {
  id: number;
  kind: TargetKind;
  x: number; // normalized 0..1 within arena width
  y: number; // normalized 0..1 within arena height
  vx: number; // normalized units per second
  vy: number;
  radius: number; // px in reference 960x540 space
  ageMs: number;
  lifeMs: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  ageMs: number;
  lifeMs: number;
}

export interface ScorePopup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  ageMs: number;
  lifeMs: number;
}

export interface HitResolution {
  hit: boolean;
  kind?: TargetKind;
  perfect?: boolean;
  overdriveTriggered?: boolean;
  hazardHit?: boolean;
  pointsDelta: number;
  comboAfter: number;
  multiplierAfter: number;
}

export interface BoothRunSummary {
  score: number;
  hits: number;
  misses: number;
  perfectHits: number;
  hazardsHit: number;
  maxCombo: number;
  accuracyPct: number;
  grade: 'S+' | 'S' | 'A' | 'B' | 'C';
  durationSec: number;
}

export interface LeaderboardEntry {
  id: string;
  initials: string;
  score: number;
  grade: BoothRunSummary['grade'];
  maxCombo: number;
  accuracyPct: number;
  playedAt: string;
}
