// What a share card says, and the caption that goes with it. No native imports.

import { inviteUrl } from './invite-link';
import { tierInfo } from './leagues';

export type ShareCard =
  | { kind: 'workout'; label: string; minutes: number; xp: number; streakWeeks: number }
  | { kind: 'streak'; weeks: number }
  | { kind: 'league'; tier: number; movedUp: boolean; rank?: number };

/** The big line on the card. */
export function cardHeadline(card: ShareCard): string {
  switch (card.kind) {
    case 'workout':
      return card.label;
    case 'streak':
      return `${card.weeks}-week streak`;
    case 'league': {
      const t = tierInfo(card.tier);
      return card.movedUp ? `Moved up to ${t.name}` : `${t.name} League`;
    }
  }
}

/** The text that goes with the image (Messages, WhatsApp; Instagram drops it). */
export function shareCaption(card: ShareCard, inviteCode: string | null): string {
  const line = (() => {
    switch (card.kind) {
      case 'workout':
        return `${card.minutes} min of ${card.label.toLowerCase()} done 💪${
          card.streakWeeks > 1 ? ` ${card.streakWeeks}-week streak 🔥` : ''
        }`;
      case 'streak':
        return `${card.weeks} weeks in a row of hitting my workout goal 🔥`;
      case 'league': {
        const t = tierInfo(card.tier);
        return card.movedUp
          ? `I moved up to the ${t.name} League ${t.emoji}`
          : `Competing in the ${t.name} League ${t.emoji}${card.rank ? `, #${card.rank} this week` : ''}`;
      }
    }
  })();
  return inviteCode ? `${line} on Sigamos. Join me: ${inviteUrl(inviteCode)}` : `${line} on Sigamos.`;
}
