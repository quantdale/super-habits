import { Text } from '@/core/ui/Text';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing } from '@/core/theme/designTokens';
import { Card } from './Card';

type FeatureStatCardProps = {
  accentColor: string;
  textColor: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  value: string | number;
  subtitle: string;
  note?: string;
  className?: string;
};

export function FeatureStatCard({
  accentColor,
  textColor,
  icon,
  title,
  value,
  subtitle,
  note,
  className,
}: FeatureStatCardProps) {
  const { tokens } = useAppTheme();

  return (
    <Card accentColor={accentColor} className={['mb-0', className].filter(Boolean).join(' ')}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-3">
            <View
              className="h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accentColor}18` }}
            >
              <MaterialIcons name={icon} size={22} color={textColor} />
            </View>
            <View className="min-w-0 flex-1">
              <Text variant="bodyMd" style={{ color: tokens.text }}>
                {title}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs / 2 }}>
                {subtitle}
              </Text>
            </View>
          </View>

          <Text variant="metric" style={{ color: tokens.text, marginTop: spacing.lg }}>
            {value}
          </Text>
          {note ? (
            <Text variant="bodyMd" tone="muted" style={{ marginTop: spacing.xs }}>
              {note}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
