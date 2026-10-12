import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';

/** W11: one objective / status / context / progress grammar for planning.
 * Visual layout is shared; goal and project persistence stays in its owner. */
type Props = {
  title: string;
  status: string;
  context?: string | null;
  targetDate?: string | null;
  progressPercent: number;
  accentColor: string;
  accessibilityLabel: string;
  onPress: () => void;
  actions?: ReactNode;
};

export function PlanningSummaryRow({
  title,
  status,
  context,
  targetDate,
  progressPercent,
  accentColor,
  accessibilityLabel,
  onPress,
  actions,
}: Props) {
  const { tokens } = useAppTheme();
  const percent = Math.max(0, Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0));

  return (
    <View
      className="rounded-2xl border px-3 py-2"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
    >
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          className="min-h-12 min-w-0 flex-1 justify-center py-1"
          onPress={onPress}
        >
          <Text className="text-base font-semibold" style={{ color: tokens.text }} numberOfLines={2}>
            {title}
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: tokens.textMuted }} numberOfLines={2}>
            {status}{context ? ` · ${context}` : ''}{targetDate ? ` · Due ${targetDate}` : ''}
          </Text>
        </Pressable>
        <Text
          className="text-sm font-semibold"
          style={{ color: tokens.text }}
          accessibilityLabel={`${percent} percent progress`}
        >
          {percent}%
        </Text>
        {actions}
      </View>
      <View className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: tokens.surfaceSunken }}>
        <View className="h-1.5 rounded-full" style={{ width: `${percent}%`, backgroundColor: accentColor }} />
      </View>
    </View>
  );
}
