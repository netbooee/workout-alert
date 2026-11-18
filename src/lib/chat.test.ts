import { describe, expect, it } from 'vitest';

import { chatBadge, chatItems, chatTime, dayLabel, momentText, previewLine, reactionEmoji } from '@/lib/chat';
import type { ChatMessage } from '@/lib/database.types';

const now = new Date(2026, 10, 12, 18, 0);

function msg(id: string, user: string | null, at: Date, kind: ChatMessage['kind'] = 'text'): ChatMessage {
  return {
    id,
    user_id: user,
    kind,
    body: kind === 'text' ? 'hi' : null,
    created_at: at.toISOString(),
    name: user ?? 'Someone',
    mascot: 'lotl',
    avatar_url: null,
    is_me: false,
    reactions: [],
  };
}

describe('previewLine', () => {
  it('shows who said what', () => {
    expect(previewLine({ last_kind: 'text', last_body: 'See you at 6', last_name: 'Monica', last_is_me: false })).toBe(
      'Monica: See you at 6',
    );
    expect(previewLine({ last_kind: 'text', last_body: 'In', last_name: 'Tony', last_is_me: true })).toBe('You: In');
  });
  it('describes moments and empty chats', () => {
    expect(previewLine({ last_kind: 'goal_hit', last_body: null, last_name: 'Monica', last_is_me: false })).toBe(
      'Monica’s weekly goal is done',
    );
    expect(previewLine({ last_kind: null, last_body: null, last_name: 'Someone', last_is_me: false })).toMatch(/Say hi/);
  });
});

describe('momentText', () => {
  it('speaks to you about your own moments', () => {
    expect(momentText('joined', 'Tony', true)).toBe('You joined the group');
    expect(momentText('squad_done', 'Someone', false)).toBe('The squad made it this week');
  });
});

describe('chatBadge', () => {
  it('counts groups with something new, not muted ones', () => {
    expect(
      chatBadge([
        { unread: 3, muted: false },
        { unread: 1, muted: true },
        { unread: 0, muted: false },
        { unread: 9, muted: false },
      ]),
    ).toBe(2);
    expect(chatBadge(undefined)).toBe(0);
  });
});

describe('reactionEmoji', () => {
  it('tosses the author’s buddy’s favorite treat', () => {
    expect(reactionEmoji('treat', 'capybara')).toBe('🍊');
    expect(reactionEmoji('treat', 'lotl')).toBe('🦐');
    expect(reactionEmoji('fire', 'lotl')).toBe('🔥');
  });
});

describe('chatTime and dayLabel', () => {
  it('shows the time today and the day before that', () => {
    expect(chatTime(new Date(2026, 10, 12, 9, 5), now)).toBe('9:05 AM');
    expect(chatTime(new Date(2026, 10, 11, 9, 5), now)).toBe('Yesterday');
    expect(chatTime(new Date(2026, 10, 10, 9, 5), now)).toBe('Tue');
    expect(chatTime(new Date(2026, 10, 1, 9, 5), now)).toBe('Nov 1');
    expect(dayLabel(new Date(2026, 10, 12, 1), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 9, 1), now)).toBe('Monday');
  });
});

describe('chatItems', () => {
  it('runs messages from one person together and adds day dividers', () => {
    const items = chatItems(
      [
        msg('4', 'a', new Date(2026, 10, 12, 17, 3)),
        msg('3', 'a', new Date(2026, 10, 12, 17, 1)),
        msg('2', 'b', new Date(2026, 10, 12, 17, 0)),
        msg('1', 'b', new Date(2026, 10, 11, 17, 0)),
      ],
      now,
    );
    expect(items.map((i) => (i.type === 'day' ? i.label : i.key))).toEqual(['4', '3', '2', 'Today', '1', 'Yesterday']);
    const byKey = Object.fromEntries(items.flatMap((i) => (i.type === 'message' ? [[i.key, i]] : [])));
    expect(byKey['4']).toMatchObject({ showName: false, showBuddy: true });
    expect(byKey['3']).toMatchObject({ showName: true, showBuddy: false });
    expect(byKey['2']).toMatchObject({ showName: true, showBuddy: true });
  });
  it('keeps moments on their own', () => {
    const items = chatItems(
      [msg('2', 'a', new Date(2026, 10, 12, 17, 1)), msg('1', 'a', new Date(2026, 10, 12, 17, 0), 'goal_hit')],
      now,
    );
    expect(items[0]).toMatchObject({ showName: true });
  });
});
