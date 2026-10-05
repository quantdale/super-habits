import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';

type PageHeaderProps = {
  title: string;
  /**
   * Deprecated in V3 (docs/ui-ux/13 §5): screens must not carry explanatory
   * doc-copy subtitles. Existing call sites keep rendering a muted caption
   * until each screen wave removes it.
   */
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  /** Small uppercase kicker above the title (greeting, context, section name). */
  eyebrow?: string;
};

/**
 * Compact screen header (V3): a 22/700 title with an optional kicker and a
 * right-aligned action cluster. Pop's oversized 900-weight hero block pushed
 * content below the fold on every phone screen; V3 headers stay under ~64px
 * so the first content element lands within the first ~200px.
 */
export function PageHeader({ title, subtitle, actions, className, eyebrow }: PageHeaderProps) {
  const { tokens } = useAppTheme();

  return (
    <View
      className={['flex-row flex-wrap items-start justify-between gap-3', className]
        .filter(Boolean)
        .join(' ')}
    >
      <View className="min-w-0 flex-1">
        {eyebrow ? (
          <Text
            variant="caption"
            tone="muted"
            style={{ letterSpacing: 0.8, marginBottom: 2, textTransform: 'uppercase' }}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="titleLg" style={{ color: tokens.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View className="shrink-0 flex-row flex-wrap items-center justify-end gap-2">
          {actions}
        </View>
      ) : null}
    </View>
  );
}
