import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, type KeyboardEvent } from 'react-native';

/**
 * The keyboard's height (including the suggestions bar), animated with the
 * keyboard. Use it as bottom padding on a screen that reaches the bottom of the
 * display to keep a pinned footer above the keyboard.
 *
 * KeyboardAvoidingView (and measuring in "window" coordinates) is off by the
 * sheet's top offset inside sheet modals, so the footer ended up hidden behind
 * the suggestions bar. The keyboard's own height doesn't depend on that.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const update = (e: KeyboardEvent, next: number) => {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(e.duration || 250, LayoutAnimation.Types.keyboard, 'opacity'),
      );
      setHeight(next);
    };
    const subs = [
      // Fires again when the suggestions bar appears or the keyboard type changes.
      Keyboard.addListener('keyboardWillChangeFrame', (e) => update(e, e.endCoordinates.height)),
      Keyboard.addListener('keyboardWillHide', (e) => update(e, 0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return height;
}
