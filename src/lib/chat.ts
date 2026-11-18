// Group chat helpers: reactions, previews, times and how messages group on
// screen. No native imports, so it stays unit-testable.

import type { ChatMessage, ChatMessageKind, ChatReaction, ChatSummary } from '@/lib/database.types';
import { MASCOTS, mascotKind } from '@/lib/mascots';

/** The five reactions, in the order the picker shows them. "treat" uses the author's buddy's treat. */
export const CHAT_REACTIONS: { key: ChatReaction; emoji: string; label: string }[] = [
  { key: 'heart', emoji: '❤️', label: 'Heart' },
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'strong', emoji: '💪', label: 'Strong' },
  { key: 'laugh', emoji: '😂', label: 'Laugh' },
  { key: 'treat', emoji: '🍊', label: 'Toss a treat' },
];

export const MAX_MESSAGE_LENGTH = 1000;

/** The emoji for a reaction on a message by someone with this buddy. */
export function reactionEmoji(reaction: ChatReaction, mascot: string | null | undefined): string {
  if (reaction === 'treat') return MASCOTS[mascotKind(mascot)].treat.emoji;
  return CHAT_REACTIONS.find((r) => r.key === reaction)?.emoji ?? '❤️';
}

/** What the app says for a moment it posted. */
export function momentText(kind: ChatMessageKind, name: string, isMe: boolean): string {
  switch (kind) {
    case 'goal_hit':
      return isMe ? 'Your weekly goal is done' : `${name}’s weekly goal is done`;
    case 'joined':
      return isMe ? 'You joined the group' : `${name} joined the group`;
    case 'squad_done':
      return 'The squad made it this week';
    default:
      return '';
  }
}

/** The Chats tab's one-line preview of the newest message. */
export function previewLine(c: Pick<ChatSummary, 'last_kind' | 'last_body' | 'last_name' | 'last_is_me'>): string {
  if (!c.last_kind) return 'Say hi to your group 👋';
  if (c.last_kind !== 'text') return momentText(c.last_kind, c.last_name, c.last_is_me);
  return `${c.last_is_me ? 'You' : c.last_name}: ${c.last_body ?? ''}`;
}

/** The number on the Chats tab: groups with something new, not counting muted ones. */
export function chatBadge(chats: Pick<ChatSummary, 'unread' | 'muted'>[] | undefined): number {
  return (chats ?? []).filter((c) => c.unread > 0 && !c.muted).length;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/** "6:12 PM" today, "Yesterday", "Tue" this week, else "Nov 3". */
export function chatTime(date: Date, now: Date = new Date()): string {
  const days = daysBetween(date, now);
  if (days <= 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Day dividers in the chat: "Today", "Yesterday", "Tuesday", "Nov 3". */
export function dayLabel(date: Date, now: Date = new Date()): string {
  const days = daysBetween(date, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export type ChatItem =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'message';
      key: string;
      message: ChatMessage;
      /** First of a run from the same person: show their name. */
      showName: boolean;
      /** Last of a run: show their buddy next to the bubble. */
      showBuddy: boolean;
    };

const RUN_GAP_MS = 5 * 60_000;

function sameRun(a: ChatMessage, b: ChatMessage) {
  return (
    a.kind === 'text' &&
    b.kind === 'text' &&
    a.user_id === b.user_id &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < RUN_GAP_MS &&
    startOfDay(new Date(a.created_at)).getTime() === startOfDay(new Date(b.created_at)).getTime()
  );
}

/**
 * Messages (newest first, as the chat loads them) into rows for an inverted
 * list, newest first: messages from one person within a few minutes run
 * together under one name and one buddy, with a divider before each new day.
 */
export function chatItems(newestFirst: ChatMessage[], now: Date = new Date()): ChatItem[] {
  const items: ChatItem[] = [];
  newestFirst.forEach((m, i) => {
    const newer = newestFirst[i - 1];
    const older = newestFirst[i + 1];
    items.push({
      type: 'message',
      key: m.id,
      message: m,
      showName: !older || !sameRun(older, m),
      showBuddy: !newer || !sameRun(m, newer),
    });
    const day = startOfDay(new Date(m.created_at)).getTime();
    if (!older || startOfDay(new Date(older.created_at)).getTime() !== day) {
      items.push({ type: 'day', key: `day-${day}`, label: dayLabel(new Date(m.created_at), now) });
    }
  });
  return items;
}
