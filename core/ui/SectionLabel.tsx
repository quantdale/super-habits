import { Text } from '@/core/ui/Text';
import { spacing } from '@/core/theme/designTokens';

type SectionLabelProps = {
  children: string;
  className?: string;
};

/**
 * Quiet group label (V3): a small muted eyebrow that names a group. This
 * replaces Pop's saturated card header bands — a slab of solid section color
 * dominated every screen and crushed content contrast (defect SYS-02). The
 * label carries hierarchy through size/tracking, not through surface area.
 */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <Text
      variant="caption"
      tone="muted"
      className={className}
      style={{
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </Text>
  );
}
