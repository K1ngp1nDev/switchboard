/**
 * High-frequency playback position, kept outside React state on purpose.
 * The rAF clock mutates it every frame; 60fps consumers (HUD numbers,
 * timeline playhead) read it from their own rAF loops. React re-renders are
 * driven by the store's coarse tick (~12Hz) instead.
 */
export const playhead = {
  t: 0,
  duration: 0,
}
