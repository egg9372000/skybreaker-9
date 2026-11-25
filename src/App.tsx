import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Flame,
  Monitor,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { arcadeSfx } from './game/audio';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  DEFAULT_DURATION_MS,
  getComboMultiplier,
  SkybreakerEngine,
} from './game/engine';
import {
  loadLeaderboard,
  resetBoothLeaderboard,
  saveScoreToLeaderboard,
} from './game/leaderboard';
import type { BoothRunSummary, LeaderboardEntry } from './game/types';

type Phase = 'attract' | 'playing' | 'gameover';

function getInitialDurationMs(): number {
  if (typeof window === 'undefined') return DEFAULT_DURATION_MS;
  const params = new URLSearchParams(window.location.search);
  const sec = Number(params.get('duration'));
  if (Number.isFinite(sec) && sec >= 5 && sec <= 180) return sec * 1000;
  return DEFAULT_DURATION_MS;
}

export default function App() {
  const durationMs = useRef(getInitialDurationMs()).current;
  const engineRef = useRef<SkybreakerEngine>(new SkybreakerEngine(durationMs));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>('attract');
  const [boothMode, setBoothMode] = useState(true);
  const [muted, setMuted] = useState(false);

  // Live HUD snapshot
  const [hud, setHud] = useState({
    score: 0,
    combo: 0,
    multiplier: 1,
    remainingSec: Math.round(durationMs / 1000),
    overdrive: false,
  });

  const [summary, setSummary] = useState<BoothRunSummary | null>(null);
  const [initials, setInitials] = useState('');
  const [savedScore, setSavedScore] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => loadLeaderboard());
  const [idleCountdown, setIdleCountdown] = useState(20);

  const startNewRun = useCallback(() => {
    const eng = engineRef.current;
    eng.reset(durationMs);
    setSummary(null);
    setSavedScore(false);
    setInitials('');
    setIdleCountdown(20);
    setHud({
      score: 0,
      combo: 0,
      multiplier: 1,
      remainingSec: Math.ceil(durationMs / 1000),
      overdrive: false,
    });
    arcadeSfx.startRun();
    setPhase('playing');
  }, [durationMs]);

  // Spacebar instant-start for booth kiosks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space' && phase !== 'playing') {
        e.preventDefault();
        startNewRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, startNewRun]);

  // Booth Mode auto-reset on Game Over screen after 20s idle so unattended kiosks stay ready
  useEffect(() => {
    if (phase !== 'gameover' || !boothMode) return;
    const id = window.setInterval(() => {
      setIdleCountdown((prev) => {
        if (prev <= 1) {
          setPhase('attract');
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, boothMode]);

  // Main 60fps Canvas render & simulation loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudTickAcc = 0;

    const drawArena = (now: number) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;

      const eng = engineRef.current;
      if (phase === 'playing') {
        eng.step(dt);
        hudTickAcc += dt;
        if (hudTickAcc >= 60 || eng.finished) {
          hudTickAcc = 0;
          setHud({
            score: eng.score,
            combo: eng.combo,
            multiplier: getComboMultiplier(eng.combo),
            remainingSec: Math.ceil(eng.remainingMs / 1000),
            overdrive: eng.overdriveMs > 0,
          });
        }
        if (eng.finished) {
          arcadeSfx.finish();
          setSummary(eng.getSummary());
          setPhase('gameover');
        }
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.save();
        ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        // Background arena grid
        const bgGrad = ctx.createRadialGradient(
          ARENA_WIDTH / 2,
          ARENA_HEIGHT / 2,
          40,
          ARENA_WIDTH / 2,
          ARENA_HEIGHT / 2,
          560
        );
        bgGrad.addColorStop(0, eng.overdriveMs > 0 ? '#1e1038' : '#0b1830');
        bgGrad.addColorStop(1, '#040914');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        // Subtle screen shake on glitch mine hit
        if (eng.shakeMs > 0) {
          const mag = (eng.shakeMs / 240) * 9;
          ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        }

        // Animated esports arena grid lines
        ctx.strokeStyle =
          eng.overdriveMs > 0 ? 'rgba(168, 85, 247, 0.16)' : 'rgba(0, 174, 239, 0.11)';
        ctx.lineWidth = 1;
        const offset = ((now * 0.025) % 48);
        for (let x = offset; x < ARENA_WIDTH; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, ARENA_HEIGHT);
          ctx.stroke();
        }
        for (let y = offset; y < ARENA_HEIGHT; y += 48) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(ARENA_WIDTH, y);
          ctx.stroke();
        }

        // Draw active targets
        for (const t of eng.targets) {
          const x = t.x * ARENA_WIDTH;
          const y = t.y * ARENA_HEIGHT;
          const progress = Math.min(1, t.ageMs / t.lifeMs);

          if (t.kind === 'orb') {
            ctx.beginPath();
            ctx.arc(x, y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 174, 239, 0.25)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#00aeef';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, t.radius * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = '#e0f2fe';
            ctx.fill();
          } else if (t.kind === 'precision') {
            const inSweetSpot = progress >= 0.45 && progress <= 0.86;
            // Shrinking timing ring
            const outerR = t.radius * (2.1 - progress * 1.25);
            ctx.beginPath();
            ctx.arc(x, y, Math.max(t.radius * 0.8, outerR), 0, Math.PI * 2);
            ctx.lineWidth = inSweetSpot ? 4 : 2.5;
            ctx.strokeStyle = inSweetSpot ? '#fef08a' : 'rgba(250, 204, 21, 0.75)';
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, t.radius, 0, Math.PI * 2);
            ctx.fillStyle = inSweetSpot ? 'rgba(250, 204, 21, 0.38)' : 'rgba(250, 204, 21, 0.18)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#facc15';
            ctx.stroke();

            ctx.fillStyle = '#fef9c3';
            ctx.font = 'bold 12px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(inSweetSpot ? 'CRIT!' : 'RING', x, y);
          } else if (t.kind === 'comet') {
            // Violet-cyan hyper overdrive comet
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(now * 0.008);
            ctx.beginPath();
            ctx.moveTo(0, -t.radius);
            ctx.lineTo(t.radius, 0);
            ctx.lineTo(0, t.radius);
            ctx.lineTo(-t.radius, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(168, 85, 247, 0.45)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#d8b4fe';
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#ffffff';
            ctx.font = '900 13px ui-monospace, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('2×', x, y);
          } else if (t.kind === 'hazard') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(-now * 0.004);
            ctx.beginPath();
            for (let s = 0; s < 8; s++) {
              const a = (Math.PI * 2 * s) / 8;
              const r = s % 2 === 0 ? t.radius + 5 : t.radius - 4;
              if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
              else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = '#f43f5e';
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#fecdd3';
            ctx.font = '900 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('✕', x, y);
          }
        }

        // Particles
        for (const p of eng.particles) {
          ctx.globalAlpha = Math.max(0, 1 - p.ageMs / p.lifeMs);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Score Popups
        for (const pop of eng.popups) {
          ctx.globalAlpha = Math.max(0, 1 - pop.ageMs / pop.lifeMs);
          ctx.fillStyle = pop.color;
          ctx.font = '900 18px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(pop.text, pop.x, pop.y);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      rafId = requestAnimationFrame(drawArena);
    };

    rafId = requestAnimationFrame(drawArena);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  const handleArenaPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * ARENA_WIDTH;
    const py = ((e.clientY - rect.top) / rect.height) * ARENA_HEIGHT;

    const res = engineRef.current.handleTap(px, py);
    if (res.hazardHit) arcadeSfx.hitHazard();
    else if (res.overdriveTriggered) arcadeSfx.triggerOverdrive();
    else if (res.perfect) arcadeSfx.hitPerfect(res.comboAfter);
    else if (res.hit) arcadeSfx.hitOrb(res.comboAfter);
    else arcadeSfx.miss();

    setHud({
      score: engineRef.current.score,
      combo: engineRef.current.combo,
      multiplier: res.multiplierAfter,
      remainingSec: Math.ceil(engineRef.current.remainingMs / 1000),
      overdrive: engineRef.current.overdriveMs > 0,
    });
  };

  const handleSaveInitials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary || savedScore) return;
    const updated = saveScoreToLeaderboard(initials, summary);
    setLeaderboard(updated);
    setSavedScore(true);
    setIdleCountdown(20);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    arcadeSfx.muted = next;
  };

  return (
    <div className="sb-shell">
      <header className="sb-header">
        <div className="sb-brand">
          <div className="sb-logo">S9</div>
          <div>
            <h1>SKYBREAKER 9</h1>
            <p>60-Second Esports Booth Precision Arcade · Zero-Tutorial Kiosk Loop</p>
          </div>
        </div>

        <div className="sb-controls">
          <button
            className={`chip-btn ${boothMode ? 'active' : ''}`}
            onClick={() => setBoothMode((b) => !b)}
            title="Auto-returns to Attract Screen after 20s idle for convention kiosks"
          >
            <Monitor size={14} /> Booth Kiosk Auto-Reset: {boothMode ? 'ON' : 'OFF'}
          </button>
          <button className="chip-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          {phase === 'playing' && (
            <button className="chip-btn" onClick={() => setPhase('attract')}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </header>

      {/* Live HUD */}
      <section className="hud-bar">
        <div className="hud-tile">
          <span className="hud-lbl">SCORE</span>
          <span className="hud-val" style={{ color: '#38bdf8' }}>
            {hud.score.toLocaleString()}
          </span>
        </div>
        <div className="hud-tile">
          <span className="hud-lbl">COMBO STREAK</span>
          <span className="hud-val" style={{ color: hud.combo >= 6 ? '#facc15' : '#f8fafc' }}>
            {hud.combo} <span style={{ fontSize: 15, color: '#00aeef' }}>×{hud.multiplier}</span>
          </span>
        </div>
        <div className="hud-tile">
          <span className="hud-lbl">TIME LEFT</span>
          <span
            className="hud-val"
            style={{ color: hud.remainingSec <= 10 && phase === 'playing' ? '#f43f5e' : '#f8fafc' }}
          >
            {hud.remainingSec}s
          </span>
        </div>
        <div className="hud-tile">
          <span className="hud-lbl">MODE STATUS</span>
          <span className="hud-val" style={{ fontSize: 16, color: hud.overdrive ? '#d8b4fe' : '#10b981', marginTop: 4 }}>
            {hud.overdrive ? '⚡ 2× OVERDRIVE' : phase === 'playing' ? '● LIVE ARENA' : '● READY'}
          </span>
        </div>
      </section>

      {/* 60FPS Arena Stage */}
      <main className={`arena-frame ${hud.overdrive ? 'overdrive' : ''}`}>
        <canvas
          ref={canvasRef}
          width={ARENA_WIDTH}
          height={ARENA_HEIGHT}
          className="arena-canvas"
          onPointerDown={handleArenaPointerDown}
        />

        {/* ATTRACT SCREEN */}
        {phase === 'attract' && (
          <div className="arena-overlay">
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', color: '#38bdf8', fontFamily: 'var(--mono)' }}>
              BOOTH CHALLENGE · MOUSE OR TOUCH ONLY · 60 SECONDS
            </div>
            <h2 className="attract-title">SKYBREAKER 9</h2>
            <div className="legend-cards">
              <div className="legend-pill">
                <strong style={{ color: '#00aeef' }}>● Aero Orb</strong>
                Click fast to build up to ×8 combo
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#facc15' }}>◎ Precision Ring</strong>
                Tap inside gold halo for PERFECT +250
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#d8b4fe' }}>◆ 2× Comet</strong>
                Catch for 5s OVERDRIVE + +2s time
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#f43f5e' }}>✕ Glitch Mine</strong>
                Avoid! Breaks streak &amp; -150 pts
              </div>
            </div>
            <button className="play-cta" onClick={startNewRun}>
              <Play size={20} fill="currentColor" /> START 60s BOOTH RUN
            </button>
            <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>
              Click button or press <code>SPACE</code> to drop straight into the arena
            </div>
          </div>
        )}

        {/* GAME OVER / BOOTH SCOREBOARD SCREEN */}
        {phase === 'gameover' && summary && (
          <div className="arena-overlay">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#facc15', fontWeight: 900, fontSize: 13 }}>
              <Award size={18} /> RUN COMPLETE · GRADE {summary.grade}
            </div>
            <div style={{ fontSize: 44, fontWeight: 900, fontFamily: 'var(--mono)', color: '#38bdf8', lineHeight: 1 }}>
              {summary.score.toLocaleString()}
            </div>

            <div className="result-grid">
              <div className="legend-pill">
                <strong style={{ color: '#10b981' }}>{summary.accuracyPct}%</strong>
                Accuracy
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#facc15' }}>{summary.perfectHits}</strong>
                Perfect Crits
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#38bdf8' }}>×{summary.maxCombo}</strong>
                Max Streak
              </div>
              <div className="legend-pill">
                <strong style={{ color: '#f43f5e' }}>{summary.hazardsHit}</strong>
                Mines Hit
              </div>
            </div>

            {!savedScore ? (
              <form className="initials-form" onSubmit={handleSaveInitials}>
                <input
                  className="initials-input"
                  value={initials}
                  onChange={(e) => {
                    setInitials(e.target.value.toUpperCase().slice(0, 3));
                    setIdleCountdown(20);
                  }}
                  placeholder="C9X"
                  maxLength={3}
                  aria-label="3-letter arcade initials"
                  required
                />
                <button type="submit" className="play-cta" style={{ padding: '11px 20px', fontSize: 14 }}>
                  <Trophy size={16} /> SAVE TO BOOTH BOARD
                </button>
              </form>
            ) : (
              <div style={{ color: '#10b981', fontWeight: 800, fontSize: 14 }}>
                ✓ Score posted to the Live Booth Hall of Fame!
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="play-cta" style={{ padding: '11px 22px', fontSize: 14 }} onClick={startNewRun}>
                <Zap size={16} /> PLAY AGAIN (SPACE)
              </button>
              {boothMode && (
                <span style={{ fontSize: 11.5, color: 'var(--dim)', fontFamily: 'var(--mono)' }}>
                  Auto-reset to Attract Mode in {idleCountdown}s
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Persistent Local Booth Hall of Fame */}
      <section className="lb-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5 }}>
            <Flame size={16} color="#facc15" /> LIVE BOOTH HALL OF FAME (LOCAL KIOSK LEADERBOARD)
          </div>
          <button
            className="chip-btn"
            style={{ fontSize: 11 }}
            onClick={() => setLeaderboard(resetBoothLeaderboard())}
          >
            Staff Reset Board
          </button>
        </div>
        <div className="lb-grid">
          {leaderboard.slice(0, 6).map((row, idx) => (
            <div key={row.id} className={`lb-pill ${idx === 0 ? 'top' : ''}`}>
              <span>
                #{idx + 1} <strong>{row.initials}</strong> ({row.grade})
              </span>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>{row.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
