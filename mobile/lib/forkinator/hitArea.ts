import { FORKINATOR_HEIGHT_PX, FORKINATOR_WIDTH_PX } from './position';

/** Touch target width — roughly the opaque fork body (asset is mostly transparent). */
export const FORKINATOR_HIT_WIDTH_PX = 30;

/** Touch target height — fork tines through handle, excluding large transparent margins. */
export const FORKINATOR_HIT_HEIGHT_PX = 88;

/** Inset from the left of the 44px asset box (fork silhouette sits on the right). */
export const FORKINATOR_HIT_INSET_LEFT_PX = FORKINATOR_WIDTH_PX - FORKINATOR_HIT_WIDTH_PX;

export const FORKINATOR_HIT_INSET_TOP_PX = Math.round(
  (FORKINATOR_HEIGHT_PX - FORKINATOR_HIT_HEIGHT_PX) / 2,
);
