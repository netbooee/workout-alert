// What people see for XP: "treats" (the points your buddy collects). Code, tables
// and columns keep the xp name; only words on screen and in notifications change.

/** "1 treat", "18 treats", "3,573 treats". */
export function treats(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'treat' : 'treats'}`;
}
