import type { WidgetInput } from '@/lib/widget';

// Widgets are iOS-only (see sync.ios.ts); elsewhere these do nothing.

export async function updateWidget(_input: Omit<WidgetInput, 'imageDir'>): Promise<void> {}

export function resetWidget(): void {}
