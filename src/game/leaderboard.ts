import type { BoothRunSummary, LeaderboardEntry } from './types';

const STORAGE_KEY = 'skybreaker9_booth_leaderboard_v1';

const SEED_ENTRIES: LeaderboardEntry[] = [
  { id: 'seed-1', initials: 'SKY', score: 14850, grade: 'S', maxCombo: 21, accuracyPct: 91, playedAt: '2026-11-25T09:00:00Z' },
  { id: 'seed-2', initials: 'JET', score: 11400, grade: 'S', maxCombo: 16, accuracyPct: 86, playedAt: '2026-11-25T09:15:00Z' },
  { id: 'seed-3', initials: 'ACE', score: 8250, grade: 'A', maxCombo: 12, accuracyPct: 81, playedAt: '2026-11-25T09:30:00Z' },
];

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [...SEED_ENTRIES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...SEED_ENTRIES];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...SEED_ENTRIES];
  } catch {
    return [...SEED_ENTRIES];
  }
}

export function saveScoreToLeaderboard(
  initialsRaw: string,
  summary: BoothRunSummary
): LeaderboardEntry[] {
  const cleanInitials =
    initialsRaw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3) || 'PLY';

  const nextEntry: LeaderboardEntry = {
    id: `run-${Date.now().toString(36)}`,
    initials: cleanInitials,
    score: summary.score,
    grade: summary.grade,
    maxCombo: summary.maxCombo,
    accuracyPct: summary.accuracyPct,
    playedAt: new Date().toISOString(),
  };

  const merged = [...loadLeaderboard(), nextEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage quota errors in restricted kiosk modes
    }
  }
  return merged;
}

export function resetBoothLeaderboard(): LeaderboardEntry[] {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  return [...SEED_ENTRIES];
}
