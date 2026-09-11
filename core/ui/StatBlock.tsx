import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { radius, spacing } from '@/core/theme/designTokens';

type StatBlockProps = {
  accentColor: string;
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  detail?: string;
  className?: string;
  align?: 'center' | 'start';
};

/**
 * Compact metric tile: a big colored number over a small caps label. Pop keeps
 * the number loud and the label quiet so a row of tiles scans instantly.
 */
export function StatBlock({
  accentColor,
  icon,
  value,
  label,
  detail,
  className,
  align = 'center',
}: StatBlockProps) {
  return (
    <Card
      variant="stat"
      accentColor={accentColor}
      flat
      className={['mb-0', className].filter(Boolean).join(' ')}
    >
      <View
        style={{
          alignItems: align === 'start' ? 'flex-start' : 'center',
          gap: spacing.xs,
          paddingVertical: spacing.xs,
        }}
      >
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accentColor}1F`,
            }}
          >
            {icon}
          </View>
        ) : null}
        <Text variant="titleLg" style={{ color: accentColor, fontSize: 26 }}>
          {value}
        </Text>
        <Text
          variant="label"
          tone="muted"
          style={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11 }}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            variant="caption"
            tone="muted"
            style={{ textAlign: align === 'start' ? 'left' : 'center' }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
