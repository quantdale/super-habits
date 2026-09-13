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
  const { tokens } = useAppTheme();
  // The big number is painted with the accent over the tile's 10% tint; a
  // mid-tone hue there measures ~2:1, so nudge it toward a readable text
  // colour against the surface the tint sits on.
  const valueColor = readableAccent(accentColor, tokens.surfaceElevated);
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
        <Text variant="titleLg" style={{ color: valueColor, fontSize: 26 }}>
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
