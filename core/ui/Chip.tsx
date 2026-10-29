/**
 * Chip — the v2 compact pill (Playful Momentum §6). The implementation lives
 * in `PillChip.tsx` beside its back-compat alias so every existing
 * `import { PillChip } from '@/core/ui/PillChip'` caller keeps working; this
 * file is the canonical `Chip` import path for new code.
 */
export { Chip, PillChip } from '@/core/ui/PillChip';
export type { ChipProps } from '@/core/ui/PillChip';
