/** Touch Y for pull-to-refresh on web (RN maps TouchEvent → nativeEvent without top-level pageY). */
export function touchPageYFromNativeEvent(
  nativeEvent: {
    pageY?: number;
    touches?: readonly { pageY?: number; clientY?: number }[];
    changedTouches?: readonly { pageY?: number; clientY?: number }[];
  },
  phase: 'start' | 'move' | 'end',
): number | null {
  if (typeof nativeEvent.pageY === 'number' && Number.isFinite(nativeEvent.pageY)) {
    return nativeEvent.pageY;
  }
  const touchList =
    phase === 'end'
      ? nativeEvent.changedTouches ?? nativeEvent.touches
      : nativeEvent.touches ?? nativeEvent.changedTouches;
  const touch = touchList?.[0];
  if (!touch) return null;
  if (typeof touch.pageY === 'number' && Number.isFinite(touch.pageY)) {
    return touch.pageY;
  }
  if (typeof touch.clientY === 'number' && Number.isFinite(touch.clientY)) {
    return touch.clientY;
  }
  return null;
}
