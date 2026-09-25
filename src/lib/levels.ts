// Levels grow like Duolingo's: early ones come fast, later ones take longer.
// Level n starts at 50·n·(n−1) XP → L2 at 100, L3 at 300, L5 at 1,000, L10 at 4,500.

export function levelStart(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned inside the current level. */
  into: number;
  /** XP needed to go from this level to the next. */
  span: number;
  progress: number;
}

const TITLES: [minLevel: number, title: string][] = [
  [1, 'Rookie'],
  [3, 'Regular'],
  [5, 'Grinder'],
  [8, 'Iron'],
  [12, 'Machine'],
  [20, 'Legend'],
];

export function levelTitle(level: number): string {
  let title = TITLES[0][1];
  for (const [min, t] of TITLES) if (level >= min) title = t;
  return title;
}

export function levelFor(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  // Solve 50·n·(n−1) ≤ xp for the largest integer n.
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
  while (levelStart(level + 1) <= xp) level++;
  while (level > 1 && levelStart(level) > xp) level--;

  const into = xp - levelStart(level);
  const span = levelStart(level + 1) - levelStart(level);
  return { level, title: levelTitle(level), into, span, progress: into / span };
}
