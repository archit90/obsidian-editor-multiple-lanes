/** A DOM node from any window (popouts have their own HTMLElement, so `instanceof` fails there). */
export const asEl = (t: EventTarget | null): HTMLElement | null =>
  t && (t as Node).nodeType === 1 ? (t as HTMLElement) : null;
