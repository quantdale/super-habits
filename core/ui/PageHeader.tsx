import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing } from '@/core/theme/designTokens';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  /** Small uppercase kicker above the title (greeting, context, section name). */
  eyebrow?: string;
};

/**
 * Section hero: an oversized title with an optional kicker and a right-aligned
 * action cluster. Pop keeps headers typographic rather than boxed — the size
 * jump from `titleXl` to body text is what carries hierarchy.
 */
export function PageHeader({ title, subtitle, actions, className, eyebrow }: PageHeaderProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      className={['flex-row flex-wrap items-start justify-between gap-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text
            variant="label"
            tone="muted"
            style={{ letterSpacing: 1.1, marginBottom: spacing.xs, textTransform: 'uppercase' }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="titleXl" style={{ color: tokens.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMd" tone="muted" style={{ marginTop: spacing.xs }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View className="shrink-0 flex-row flex-wrap items-center justify-end gap-2 pt-1">
          {actions}
        </View>
      ) : null}
    </View>
  );
}
