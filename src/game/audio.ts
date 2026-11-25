/**
 * Zero-asset procedural Web Audio API esports synth engine.
 * Crisp harmonic chimes that pitch up with active combo streaks!
 */
class ArcadeAudio {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensure(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, endFreq?: number) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  public startRun() {
    [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, i * 0.06));
  }

  public hitOrb(combo: number) {
    const pitchBoost = Math.min(combo, 16) * 28;
    this.tone(420 + pitchBoost, 0.09, 'sine', 0.1, 0, 620 + pitchBoost);
  }

  public hitPerfect(combo: number) {
    const pitchBoost = Math.min(combo, 16) * 24;
    this.tone(587 + pitchBoost, 0.11, 'triangle', 0.12, 0);
    this.tone(880 + pitchBoost, 0.16, 'sine', 0.11, 0.05);
  }

  public triggerOverdrive() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone(f, 0.2, 'sawtooth', 0.06, i * 0.05)
    );
  }

  public hitHazard() {
    this.tone(180, 0.22, 'sawtooth', 0.12, 0, 65);
    this.tone(110, 0.25, 'square', 0.08, 0.04, 55);
  }

  public miss() {
    this.tone(240, 0.07, 'triangle', 0.05, 0, 170);
  }

  public finish() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.11, i * 0.09));
  }
}

export const arcadeSfx = new ArcadeAudio();
