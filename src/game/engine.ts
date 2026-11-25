import type {
  ArenaTarget,
  BoothRunSummary,
  HitResolution,
  Particle,
  ScorePopup,
  TargetKind,
} from './types';

export const ARENA_WIDTH = 960;
export const ARENA_HEIGHT = 540;
export const DEFAULT_DURATION_MS = 60_000;

export function getComboMultiplier(combo: number): number {
  if (combo >= 22) return 8;
  if (combo >= 15) return 6;
  if (combo >= 10) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

export function computeGrade(score: number, accuracyPct: number): BoothRunSummary['grade'] {
  if (score >= 16000 && accuracyPct >= 82) return 'S+';
  if (score >= 11000) return 'S';
  if (score >= 7000) return 'A';
  if (score >= 3500) return 'B';
  return 'C';
}

export class SkybreakerEngine {
  public durationMs: number;
  public remainingMs: number;
  public elapsedMs = 0;
  public score = 0;
  public combo = 0;
  public maxCombo = 0;
  public hits = 0;
  public misses = 0;
  public perfectHits = 0;
  public hazardsHit = 0;
  public overdriveMs = 0;
  public shakeMs = 0;
  public finished = false;

  public targets: ArenaTarget[] = [];
  public particles: Particle[] = [];
  public popups: ScorePopup[] = [];

  private nextId = 1;
  private spawnCooldownMs = 250;
  private readonly rng: () => number;

  constructor(durationMs: number = DEFAULT_DURATION_MS, rng: () => number = Math.random) {
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.rng = rng;
  }

  public reset(durationMs: number = this.durationMs): void {
    this.durationMs = durationMs;
    this.remainingMs = durationMs;
    this.elapsedMs = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.hits = 0;
    this.misses = 0;
    this.perfectHits = 0;
    this.hazardsHit = 0;
    this.overdriveMs = 0;
    this.shakeMs = 0;
    this.finished = false;
    this.targets = [];
    this.particles = [];
    this.popups = [];
    this.spawnCooldownMs = 150;
    // Immediately seed 2 starter targets so frame 1 is instantly playable!
    this.spawnTarget('orb');
    this.spawnTarget('precision');
  }

  public step(dtMs: number): void {
    if (this.finished) return;
    const clampedDt = Math.min(dtMs, 100);
    this.elapsedMs += clampedDt;
    this.remainingMs = Math.max(0, this.remainingMs - clampedDt);
    if (this.overdriveMs > 0) this.overdriveMs = Math.max(0, this.overdriveMs - clampedDt);
    if (this.shakeMs > 0) this.shakeMs = Math.max(0, this.shakeMs - clampedDt);

    if (this.remainingMs <= 0) {
      this.finished = true;
      return;
    }

    // Spawn pacing ramps cleanly across the 60s run
    const intensity = Math.min(1, this.elapsedMs / this.durationMs);
    const maxConcurrent = intensity > 0.72 ? 6 : intensity > 0.3 ? 5 : 4;
    const baseSpawnInterval = intensity > 0.72 ? 520 : intensity > 0.3 ? 680 : 840;

    this.spawnCooldownMs -= clampedDt;
    if (this.spawnCooldownMs <= 0 && this.targets.length < maxConcurrent) {
      this.spawnTarget(this.pickTargetKind(intensity));
      this.spawnCooldownMs = baseSpawnInterval * (0.8 + this.rng() * 0.4);
    }

    // Advance targets
    const dtSec = clampedDt / 1000;
    const survivors: ArenaTarget[] = [];
    for (const t of this.targets) {
      t.ageMs += clampedDt;
      t.x += t.vx * dtSec;
      t.y += t.vy * dtSec;

      // Soft bounce for non-comets inside safe margin
      if (t.kind !== 'comet') {
        if (t.x < 0.08 || t.x > 0.92) t.vx *= -1;
        if (t.y < 0.14 || t.y > 0.88) t.vy *= -1;
      }

      const expired = t.ageMs >= t.lifeMs || t.x < -0.08 || t.x > 1.08;
      if (!expired) {
        survivors.push(t);
      } else if (t.kind === 'orb' || t.kind === 'precision') {
        // Letting a primary target expire resets streak gently
        this.combo = 0;
      }
    }
    this.targets = survivors;

    // Advance particles
    this.particles = this.particles.filter((p) => {
      p.ageMs += clampedDt;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.96;
      p.vy *= 0.96;
      return p.ageMs < p.lifeMs;
    });

    // Advance floating score popups
    this.popups = this.popups.filter((pop) => {
      pop.ageMs += clampedDt;
      pop.y -= 42 * dtSec;
      return pop.ageMs < pop.lifeMs;
    });
  }

  private pickTargetKind(intensity: number): TargetKind {
    const r = this.rng();
    if (r < 0.11 && this.overdriveMs <= 0) return 'comet';
    if (r < 0.11 + 0.14 * (0.4 + intensity)) return 'hazard';
    if (r < 0.56) return 'precision';
    return 'orb';
  }

  public spawnTarget(kind: TargetKind): ArenaTarget {
    const id = this.nextId++;
    if (kind === 'comet') {
      const fromLeft = this.rng() > 0.5;
      const target: ArenaTarget = {
        id,
        kind,
        x: fromLeft ? 0.04 : 0.96,
        y: 0.2 + this.rng() * 0.55,
        vx: (fromLeft ? 1 : -1) * (0.38 + this.rng() * 0.12),
        vy: (this.rng() - 0.5) * 0.14,
        radius: 26,
        ageMs: 0,
        lifeMs: 2800,
      };
      this.targets.push(target);
      return target;
    }

    const speed = kind === 'hazard' ? 0.09 : 0.06;
    const angle = this.rng() * Math.PI * 2;
    const target: ArenaTarget = {
      id,
      kind,
      x: 0.12 + this.rng() * 0.76,
      y: 0.18 + this.rng() * 0.66,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: kind === 'precision' ? 34 : kind === 'hazard' ? 30 : 32,
      ageMs: 0,
      lifeMs: kind === 'precision' ? 2300 : kind === 'hazard' ? 2600 : 2700,
    };
    this.targets.push(target);
    return target;
  }

  /**
   * Resolves a player pointer click/tap at arena coordinates (px in 960x540 space).
   */
  public handleTap(px: number, py: number): HitResolution {
    if (this.finished) {
      return { hit: false, pointsDelta: 0, comboAfter: this.combo, multiplierAfter: getComboMultiplier(this.combo) };
    }

    // Check topmost target first (reverse order) with generous booth touch hit padding (+10px)
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i]!;
      const tx = t.x * ARENA_WIDTH;
      const ty = t.y * ARENA_HEIGHT;
      const dist = Math.hypot(px - tx, py - ty);
      if (dist <= t.radius + 10) {
        this.targets.splice(i, 1);

        if (t.kind === 'hazard') {
          this.hazardsHit++;
          this.combo = 0;
          this.score = Math.max(0, this.score - 150);
          this.shakeMs = 240;
          this.emitBurst(tx, ty, '#f43f5e', 18);
          this.emitPopup(tx, ty, 'GLITCH! -150', '#f43f5e');
          return {
            hit: true,
            kind: 'hazard',
            hazardHit: true,
            pointsDelta: -150,
            comboAfter: 0,
            multiplierAfter: 1,
          };
        }

        this.hits++;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        const mult = getComboMultiplier(this.combo);
        const overdriveBoost = this.overdriveMs > 0 ? 2 : 1;

        let base = 100;
        let perfect = false;
        let overdriveTriggered = false;

        if (t.kind === 'precision') {
          const progress = t.ageMs / t.lifeMs;
          if (progress >= 0.45 && progress <= 0.86) {
            base = 250;
            perfect = true;
            this.perfectHits++;
          } else {
            base = 120;
          }
        } else if (t.kind === 'comet') {
          base = 300;
          overdriveTriggered = true;
          this.overdriveMs = 5000;
          this.remainingMs = Math.min(this.durationMs, this.remainingMs + 2000);
        }

        const gained = base * mult * overdriveBoost;
        this.score += gained;

        const color = overdriveTriggered
          ? '#a855f7'
          : perfect
          ? '#facc15'
          : '#00aeef';
        const label = overdriveTriggered
          ? `OVERDRIVE! +${gained}`
          : perfect
          ? `PERFECT! +${gained}`
          : `+${gained}`;

        this.emitBurst(tx, ty, color, overdriveTriggered ? 24 : perfect ? 18 : 12);
        this.emitPopup(tx, ty, label, color);

        return {
          hit: true,
          kind: t.kind,
          perfect,
          overdriveTriggered,
          pointsDelta: gained,
          comboAfter: this.combo,
          multiplierAfter: mult,
        };
      }
    }

    // Missed click on empty space
    this.misses++;
    this.combo = 0;
    this.emitPopup(px, py, 'MISS', '#94a3b8');
    return {
      hit: false,
      pointsDelta: 0,
      comboAfter: 0,
      multiplierAfter: 1,
    };
  }

  private emitBurst(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + this.rng() * 0.4;
      const spd = 80 + this.rng() * 210;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: 2.5 + this.rng() * 4,
        ageMs: 0,
        lifeMs: 360 + this.rng() * 240,
      });
    }
  }

  private emitPopup(x: number, y: number, text: string, color: string) {
    this.popups.push({
      id: this.nextId++,
      x,
      y,
      text,
      color,
      ageMs: 0,
      lifeMs: 650,
    });
  }

  public getSummary(): BoothRunSummary {
    const totalClicks = this.hits + this.misses + this.hazardsHit;
    const accuracyPct = totalClicks > 0 ? Math.round((this.hits / totalClicks) * 100) : 0;
    return {
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      perfectHits: this.perfectHits,
      hazardsHit: this.hazardsHit,
      maxCombo: this.maxCombo,
      accuracyPct,
      grade: computeGrade(this.score, accuracyPct),
      durationSec: Math.round(this.durationMs / 1000),
    };
  }
}
