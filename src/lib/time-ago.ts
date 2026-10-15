// Short relative times for comments: "now", "5m", "3h", "Tue", "Oct 3".

export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 24 * 3600) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 6 * 24 * 3600) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
