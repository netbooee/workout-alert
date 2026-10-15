import { useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, type KeyboardEvent, type View } from 'react-native';

/**
 * How many points of the view attached to `ref` the keyboard covers, animated
 * with the keyboard. Use it as bottom padding to keep a pinned footer visible.
 *
 * KeyboardAvoidingView measures relative to its parent, so inside a sheet
 * modal (which doesn't start at the top of the screen) it under-pads and the
 * keyboard still hides the footer. This measures in window coordinates instead.
 */
export function useKeyboardOverlap() {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const update = (e: KeyboardEvent, hiding: boolean) => {
      const animate = () =>
        LayoutAnimation.configureNext(
          LayoutAnimation.create(e.duration || 250, LayoutAnimation.Types.keyboard, 'opacity'),
        );
      if (hiding) {
        animate();
        setOverlap(0);
        return;
      }
      ref.current?.measureInWindow((_x, y, _width, height) => {
        animate();
        setOverlap(Math.max(0, y + height - e.endCoordinates.screenY));
      });
    };
    const subs = [
      Keyboard.addListener('keyboardWillChangeFrame', (e) => update(e, false)),
      Keyboard.addListener('keyboardWillHide', (e) => update(e, true)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  return { ref, overlap };
}
