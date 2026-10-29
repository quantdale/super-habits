/**
 * Sprout mascot pose registry (P9). Lives beside `Sprout.tsx` but outside it
 * so the component file keeps a components-only export surface for
 * `react-refresh/only-export-components`.
 */
export type SproutPose = 'idle' | 'cheer' | 'nap' | 'think' | 'proud';

/** Registry of poses — consumed by the P9 render contract test. */
export const SPROUT_POSES: readonly SproutPose[] = ['idle', 'cheer', 'nap', 'think', 'proud'];
