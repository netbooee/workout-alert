import { signedOutWidget, widgetTimeline, type WidgetInput } from '@/lib/widget';
import { widgetPictureDir } from '@/widgets/pictures';
import StreakWidget from '@/widgets/streak-widget';

/** Hands the widget a fresh timeline (what to show now and through the rest of the week). */
export async function updateWidget(input: Omit<WidgetInput, 'imageDir'>): Promise<void> {
  try {
    const imageDir = await widgetPictureDir();
    StreakWidget.updateTimeline(widgetTimeline({ ...input, imageDir }));
  } catch (e) {
    console.warn('Could not update the widget', e);
  }
}

/** Clears your streak and partners' names off the widget, e.g. after signing out. */
export function resetWidget(): void {
  try {
    StreakWidget.updateSnapshot(signedOutWidget());
  } catch (e) {
    console.warn('Could not reset the widget', e);
  }
}
