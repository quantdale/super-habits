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
 * Empty state (V3): modest art, one clear sentence, and (when the caller passes
 * it) exactly one next action. Quieted from Pop — a smaller illustration on a
 * neutral surface reads calm instead of celebratory (docs/ui-ux/13 §11).
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
    <Card className={className}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {illustration ?? icon ?? <SparkIllustration color={accentColor} size={84} />}
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
