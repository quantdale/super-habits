import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
import { readableAccent } from '@/core/theme/contrast';

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
 * Compact metric tile (V3): a neutral surface with the hue carried only by the
 * value/icon — Pop's per-tile tinted background made five-stat strips read as
 * rainbow noise (defect SYS-03). The number stays readable via readableAccent.
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
  const { tokens } = useAppTheme();
  // The big number is painted with the accent over a neutral surface; a
  // mid-tone hue there measures ~2:1, so nudge it toward a readable text
  // colour against the surface.
  const valueColor = readableAccent(accentColor, tokens.surface);
  return (
    <Card variant="stat" className={['mb-0', className].filter(Boolean).join(' ')}>
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
              width: 36,
              height: 36,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accentColor}1F`,
            }}
          >
            {icon}
          </View>
        ) : null}
        <Text variant="metric" style={{ color: valueColor, fontSize: 24 }}>
          {value}
        </Text>
        <Text variant="caption" tone="muted" style={{ fontSize: 11 }} numberOfLines={1}>
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
