/** Mascot asset box (keep in sync with `position.ts`). */
const MASCOT_WIDTH_PX = 44;
const MASCOT_HEIGHT_PX = 120;

/** Touch target width — roughly the opaque fork body (asset is mostly transparent). */
export const FORKINATOR_HIT_WIDTH_PX = 30;

/** Touch target height — fork tines through handle, excluding large transparent margins. */
export const FORKINATOR_HIT_HEIGHT_PX = 88;

/** Inset from the left of the 44px asset box (fork silhouette sits on the right). */
export const FORKINATOR_HIT_INSET_LEFT_PX = MASCOT_WIDTH_PX - FORKINATOR_HIT_WIDTH_PX;

export const FORKINATOR_HIT_INSET_TOP_PX = Math.round(
  (MASCOT_HEIGHT_PX - FORKINATOR_HIT_HEIGHT_PX) / 2,
);
