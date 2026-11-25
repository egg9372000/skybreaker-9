# ⚡ SKYBREAKER 9 — 60-Second Esports Booth Precision Arcade

> **Built for Cloud9 × JetBrains: Sky's The Limit Hackathon 2026 (Category 3: Event Mini-Game)**  
> A zero-tutorial, 60fps browser booth arcade game engineered for rapid convention turnarounds, instant visual readability, combo-driven replayability, and offline local Kiosk Hall of Fame persistence.

---

## 🎮 Booth-Ready Gameplay Loop (`Attract → 60s Run → Score & Initials → Auto-Reset`)

- **Zero-Tutorial Controls**: Mouse-only or touchscreen tap (plus `SPACE` instant restart). Visitors understand every target within 2 seconds:
  - **Aero Orb (Cyan)**: Fast click to chain up to **×8 SKYBREAK** combos.
  - **Precision Ring (Gold Halo)**: Shrinking timing ring—hit inside the sweet spot for **`PERFECT! +250`**!
  - **2× Hyper Comet (Violet)**: Fast diagonal bonus target triggering **5s Overdrive (2× points + +2s bonus time)**.
  - **Glitch Mine (Crimson Octagon)**: Avoid! Clicking resets combo and shakes the arena (`-150 pts`).
- **Convention Kiosk Reliability**:
  - **Booth Kiosk Auto-Reset Mode**: Automatically returns to the animated Attract Screen after 20 seconds idle on the Game Over screen so unattended event monitors never stall.
  - **Persistent Local Hall of Fame**: 3-letter arcade initials saved to `localStorage` with a 1-click **Staff Reset Board** control.
  - **Zero-Asset Procedural Web Audio**: Dynamic esports synth chimes that pitch up with your active combo streak (with mute toggle).
  - **100% Original IP & Assets**: Pure geometric Canvas art & procedural audio—zero third-party/Riot IP.

---

## 🛠️ Tech Stack & JetBrains IDE Workflow

- **TypeScript + React 19 + HTML5 60fps Canvas + Vite 6 + Vitest**
- **Live Browser Demo (GitHub Pages)**: `https://egg9372000.github.io/skybreaker-9/`
- **JetBrains IDE Workflow**: Open this repository in **JetBrains WebStorm** (free for non-commercial use) or **JetBrains Rider** to run TypeScript static inspections, refactor game modules, and execute the built-in Vitest test runner (`tests/engine.test.ts`).

```bash
npm install
npm run typecheck   # Strict TypeScript validation
npm test            # Automated Vitest game loop & 50-session reset reliability tests
npm run build       # Production static bundle (docs/) for GitHub Pages
npm run dev         # Local dev server (http://localhost:5177)
```
