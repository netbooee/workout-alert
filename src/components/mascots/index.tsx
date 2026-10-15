import { Capybara } from '@/components/mascots/capybara';
import { RedPanda } from '@/components/mascots/red-panda';
import { Sloth } from '@/components/mascots/sloth';
import { Lotl } from '@/components/lotl';
import type { LotlMood } from '@/lib/lotl';
import type { MascotKind } from '@/lib/mascots';

/** Draws whichever character someone picked, in the given mood. */
export function Mascot({ kind, mood, size = 120 }: { kind: MascotKind; mood: LotlMood; size?: number }) {
  switch (kind) {
    case 'capybara':
      return <Capybara mood={mood} size={size} />;
    case 'sloth':
      return <Sloth mood={mood} size={size} />;
    case 'red_panda':
      return <RedPanda mood={mood} size={size} />;
    default:
      return <Lotl mood={mood} size={size} />;
  }
}
