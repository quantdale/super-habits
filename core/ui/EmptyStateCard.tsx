import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { SparkIllustration } from '@/core/ui/illustrations/SparkIllustration';
import { radius, spacing } from '@/core/theme/designTokens';

type EmptyStateCardProps = {
  accentColor: string;
  title: string;
  description?: string;
  /** Overrides the built-in art. */
  icon?: ReactNode;
  /** Replaces the default spark illustration entirely. */
  illustration?: ReactNode;
  /** Primary next action — an empty state should always offer one. */
  children?: ReactNode;
  className?: string;
};

/**
 * Pop empty state: art, one clear sentence, and (when the caller passes it)
 * exactly one next action. Deliberately not a grey box with a sad icon — the
 * art uses the section's own hue so an empty Habits screen still feels like
 * Habits.
 */
export function EmptyStateCard({
  accentColor,
  title,
  description,
  icon,
  illustration,
  children,
  className,
}: EmptyStateCardProps) {
  return (
    <Card accentColor={accentColor} className={className}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <View
          style={{
            width: 132,
            height: 132,
            borderRadius: radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {illustration ?? icon ?? <SparkIllustration color={accentColor} size={124} />}
        </View>
        <Text variant="titleMd" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        {description ? (
          <Text
            variant="bodyMd"
            tone="muted"
            style={{ textAlign: 'center', paddingHorizontal: spacing.md }}
          >
            {description}
          </Text>
        ) : null}
        {children ? <View style={{ marginTop: spacing.sm }}>{children}</View> : null}
      </View>
    </Card>
  );
}
