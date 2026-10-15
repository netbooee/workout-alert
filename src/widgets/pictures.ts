import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

import type { LotlMood } from '@/lib/lotl';
import type { MascotKind } from '@/lib/mascots';

// Bundled images must be required statically.
const PICTURES: Record<`${MascotKind}-${LotlMood}`, number> = {
  'lotl-blazing': require('../../assets/mascots/lotl-blazing.png'),
  'lotl-happy': require('../../assets/mascots/lotl-happy.png'),
  'lotl-ready': require('../../assets/mascots/lotl-ready.png'),
  'lotl-worried': require('../../assets/mascots/lotl-worried.png'),
  'lotl-fired_up': require('../../assets/mascots/lotl-fired_up.png'),
  'lotl-sleepy': require('../../assets/mascots/lotl-sleepy.png'),
  'capybara-blazing': require('../../assets/mascots/capybara-blazing.png'),
  'capybara-happy': require('../../assets/mascots/capybara-happy.png'),
  'capybara-ready': require('../../assets/mascots/capybara-ready.png'),
  'capybara-worried': require('../../assets/mascots/capybara-worried.png'),
  'capybara-fired_up': require('../../assets/mascots/capybara-fired_up.png'),
  'capybara-sleepy': require('../../assets/mascots/capybara-sleepy.png'),
  'sloth-blazing': require('../../assets/mascots/sloth-blazing.png'),
  'sloth-happy': require('../../assets/mascots/sloth-happy.png'),
  'sloth-ready': require('../../assets/mascots/sloth-ready.png'),
  'sloth-worried': require('../../assets/mascots/sloth-worried.png'),
  'sloth-fired_up': require('../../assets/mascots/sloth-fired_up.png'),
  'sloth-sleepy': require('../../assets/mascots/sloth-sleepy.png'),
  'red_panda-blazing': require('../../assets/mascots/red_panda-blazing.png'),
  'red_panda-happy': require('../../assets/mascots/red_panda-happy.png'),
  'red_panda-ready': require('../../assets/mascots/red_panda-ready.png'),
  'red_panda-worried': require('../../assets/mascots/red_panda-worried.png'),
  'red_panda-fired_up': require('../../assets/mascots/red_panda-fired_up.png'),
  'red_panda-sleepy': require('../../assets/mascots/red_panda-sleepy.png'),
};

/** Bump when the pictures change so phones copy the new set. */
const VERSION = 2;

let ready: Promise<string | null> | null = null;

/**
 * Copies every character picture into the App Group folder the widget can read (the
 * widget can't see the app's own files) and returns that folder's file:// URI, or null
 * if there's no shared folder. Runs once per app launch; a marker file makes later
 * launches skip the copy.
 */
export function widgetPictureDir(): Promise<string | null> {
  ready ??= copyPictures().catch((e) => {
    console.warn('Could not prepare widget pictures', e);
    ready = null;
    return null;
  });
  return ready;
}

async function copyPictures(): Promise<string | null> {
  if (!widgetsDirectory) return null;
  const dir = new Directory(widgetsDirectory, `mascots-v${VERSION}`);
  const marker = new File(dir, '.complete');
  if (marker.exists) return dir.uri;

  if (!dir.exists) dir.create({ intermediates: true });
  for (const [name, module] of Object.entries(PICTURES)) {
    const [asset] = await Asset.loadAsync(module);
    if (!asset?.localUri) throw new Error(`Missing picture ${name}`);
    const target = new File(dir, `${name}.png`);
    if (target.exists) target.delete();
    await new File(asset.localUri).copy(target);
  }
  marker.create();
  return dir.uri;
}
