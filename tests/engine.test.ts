import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  computeGrade,
  getComboMultiplier,
  SkybreakerEngine,
} from '../src/game/engine';

describe('SKYBREAKER 9 — Booth Arcade Engine', () => {
  it('scales combo multipliers cleanly up to x8 SKYBREAK', () => {
    expect(getComboMultiplier(0)).toBe(1);
    expect(getComboMultiplier(3)).toBe(2);
    expect(getComboMultiplier(6)).toBe(3);
    expect(getComboMultiplier(10)).toBe(4);
    expect(getComboMultiplier(15)).toBe(6);
    expect(getComboMultiplier(22)).toBe(8);
  });

  it('awards PERFECT bonus on precision timing ring and triggers 2x Overdrive on comet hit', () => {
    const eng = new SkybreakerEngine(60_000, () => 0.5);
    eng.reset();
    eng.targets = [];

    const p = eng.spawnTarget('precision');
    p.ageMs = p.lifeMs * 0.65; // right in the golden sweet spot!
    const res1 = eng.handleTap(p.x * ARENA_WIDTH, p.y * ARENA_HEIGHT);
    expect(res1.hit).toBe(true);
    expect(res1.perfect).toBe(true);
    expect(res1.pointsDelta).toBe(250);

    const c = eng.spawnTarget('comet');
    const res2 = eng.handleTap(c.x * ARENA_WIDTH, c.y * ARENA_HEIGHT);
    expect(res2.overdriveTriggered).toBe(true);
    expect(eng.overdriveMs).toBe(5000);
  });

  it('penalizes hazard taps and resets combo cleanly across 50 repeated booth resets', () => {
    const eng = new SkybreakerEngine(15_000, () => 0.4);
    for (let run = 0; run < 50; run++) {
      eng.reset();
      expect(eng.score).toBe(0);
      expect(eng.combo).toBe(0);
      expect(eng.finished).toBe(false);
      expect(eng.targets.length).toBe(2);

      const orb = eng.targets[0]!;
      eng.handleTap(orb.x * ARENA_WIDTH, orb.y * ARENA_HEIGHT);
      expect(eng.score).toBeGreaterThan(0);

      const haz = eng.spawnTarget('hazard');
      const hRes = eng.handleTap(haz.x * ARENA_WIDTH, haz.y * ARENA_HEIGHT);
      expect(hRes.hazardHit).toBe(true);
      expect(eng.combo).toBe(0);
    }
    expect(computeGrade(17000, 90)).toBe('S+');
  });

  it('terminates cleanly at 0ms and returns accurate run summary', () => {
    const eng = new SkybreakerEngine(1000, () => 0.5);
    eng.reset();
    for (let i = 0; i < 15; i++) eng.step(100);
    expect(eng.finished).toBe(true);
    expect(eng.remainingMs).toBe(0);
    const summary = eng.getSummary();
    expect(summary.durationSec).toBe(1);
  });
});
