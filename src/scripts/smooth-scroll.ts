// Smooth, gliding scrolling for the mouse wheel and trackpad (Lenis, MIT). Touch screens keep the device's own
// scrolling, and anyone who asks for reduced motion keeps the browser's normal scrolling. Links to a part of
// the page (#features...) glide there too, stopping where the page's scroll-padding says.
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis: Lenis | null = null;

export function startSmoothScroll() {
  if (lenis || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
  lenis = new Lenis({ autoRaf: true, anchors: true, lerp: 0.09 });
}

/** Moves the page by `dy` straight away (when a section changes height under the visitor), without the
 * smooth scroll pulling it back. */
export function jumpBy(dy: number) {
  if (lenis) lenis.scrollTo(lenis.animatedScroll + dy, { immediate: true, force: true });
  else window.scrollBy(0, dy);
}
