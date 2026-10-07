import { Platform, type ImageStyle, type ViewStyle } from 'react-native';

/** Prevent browser gesture stealing on the draggable mascot wrapper (web). */
export function forkinatorDragSurfaceWebStyle(): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return {
    touchAction: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserDrag: 'none',
  } as ViewStyle;
}

/** Keep expo-image's underlying <img> from hijacking mouse drags (web). */
export function forkinatorMascotImageWebStyle(): ImageStyle {
  if (Platform.OS !== 'web') return {};
  return {
    userSelect: 'none',
    WebkitUserDrag: 'none',
  } as ImageStyle;
}
