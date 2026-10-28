import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { friendlyError } from '@/lib/errors';
import { savePhotoToLibrary } from '@/lib/save-photo';

/**
 * Full-screen photo viewer: swipe between photos, pinch or double-tap to zoom, and
 * save the one you're looking at to the camera roll. Open it by passing an index.
 */
export function PhotoViewer({
  urls,
  index,
  onClose,
}: {
  urls: string[];
  index: number | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={index != null}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      {index != null && <Viewer urls={urls} start={index} onClose={onClose} />}
    </Modal>
  );
}

function Viewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  // A Modal is its own native window, so SafeAreaView inside it measures zero insets and
  // the buttons end up under the status bar, where iOS keeps the taps. Use the app's insets.
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0, 20);
  const [page, setPage] = useState(start);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const save = async () => {
    const url = urls[page];
    if (!url) return;
    setSaving(true);
    try {
      const result = await savePhotoToLibrary(url);
      if (result === 'denied') {
        Alert.alert('Allow Sigamos to add photos', 'Turn on photo access for Sigamos in Settings to save photos.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(page);
    } catch (e) {
      Alert.alert('Couldn’t save the photo', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {urls.map((url) => (
          <ZoomablePhoto key={url} url={url} width={width} height={height} />
        ))}
      </ScrollView>

      <View style={[styles.bar, { paddingTop: top + 8 }]} pointerEvents="box-none">
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close photo" style={styles.round}>
          <SymbolView name="xmark" size={17} weight="bold" tintColor="#fff" />
        </Pressable>
        {urls.length > 1 && (
          <AppText variant="caption" color="#fff" style={styles.counter}>
            {page + 1} / {urls.length}
          </AppText>
        )}
        <Pressable
          onPress={save}
          disabled={saving || saved === page}
          hitSlop={12}
          accessibilityLabel={saved === page ? 'Saved to Photos' : 'Save to Photos'}
          style={styles.round}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <SymbolView name={saved === page ? 'checkmark' : 'square.and.arrow.down'} size={18} weight="bold" tintColor="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

/** One page: fits the whole photo on screen; pinch to zoom, double-tap to zoom in or back out. */
function ZoomablePhoto({ url, width, height }: { url: string; width: number; height: number }) {
  const [zoomed, setZoomed] = useState(false);
  const [scroller, setScroller] = useState<ScrollView | null>(null);
  const [lastTap, setLastTap] = useState(0);

  const onTap = (x: number, y: number, at: number) => {
    if (at - lastTap > 300) {
      setLastTap(at);
      return;
    }
    setLastTap(0);
    // iOS ScrollView zooms to a rectangle: a third of the screen around the tap, or back out.
    const responder = scroller?.getScrollResponder() as unknown as {
      scrollResponderZoomTo?: (rect: { x: number; y: number; width: number; height: number; animated: boolean }) => void;
    };
    const rect = zoomed
      ? { x: 0, y: 0, width, height, animated: true }
      : { x: x - width / 6, y: y - height / 6, width: width / 3, height: height / 3, animated: true };
    responder?.scrollResponderZoomTo?.(rect);
    setZoomed(!zoomed);
  };

  return (
    <ScrollView
      ref={setScroller}
      style={{ width, height }}
      contentContainerStyle={{ width, height }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onScrollEndDrag={(e) => setZoomed(e.nativeEvent.zoomScale > 1.01)}>
      <Pressable onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY, e.nativeEvent.timestamp)}>
        <Image source={url} style={{ width, height }} contentFit="contain" transition={150} accessibilityIgnoresInvertColors />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  counter: { fontWeight: '700' },
});
