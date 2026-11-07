// EL-19: expanded cards far from the visible part of their lane are unmounted ("parked") after a while, and
// mounted again (the lazy-mount observer, "Pre-load distance") before they scroll back into view. No DOM or app
// access, so it can be unit-tested.

/** A card counts as far once it has been this far away for this long. */
export const PARK_MS = 5000;
/** How often lanes look for cards to park. */
export const PARK_CHECK_MS = 1000;
/** "Far": at least this many lane heights outside the visible part (and well beyond the pre-load distance). */
export const PARK_SCREENS = 3;

/** A vertical extent in client coordinates. */
export interface Extent {
  top: number;
  bottom: number;
}

/** How far outside the visible part of a lane `viewHeight` tall a card must be to be parked. */
export function parkDistance(viewHeight: number, preloadDistance: number): number {
  return Math.max(PARK_SCREENS * viewHeight, preloadDistance + 2 * viewHeight);
}

/** The card lies entirely more than `distance` above or below the visible part. */
export function isFar(view: Extent, card: Extent, distance: number): boolean {
  return card.bottom < view.top - distance || card.top > view.bottom + distance;
}

/**
 * One check for one card: when it was first seen far away (null: it isn't, or it mustn't be parked), and whether
 * to park it now.
 */
export function parkStep(
  farSince: number | undefined,
  far: boolean,
  keep: boolean,
  now: number,
): { since: number | null; park: boolean } {
  if (!far || keep) return { since: null, park: false };
  const since = farSince ?? now;
  return { since, park: now - since >= PARK_MS };
}
