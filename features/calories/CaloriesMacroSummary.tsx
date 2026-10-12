import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { Text } from '@/core/ui/Text';

export type MacroSummaryRow = {
  key: string;
  label: string;
  actual: number;
  target: number;
  percent: number;
  remaining: number;
  over: boolean;
};

type Props = {
  rows: MacroSummaryRow[];
  accentColor: string;
  onEditTargets: () => void;
};

/**
 * Compact macro summary (V3 W10): one row per macro with logged amount,
 * daily target and a slim progress bar. A macro whose target is unset or zero
 * renders no row. The proportional donut that used to repeat these three
 * values was removed with the W10 reconstruction.
 */
export function CaloriesMacroSummary({ rows, accentColor, onEditTargets }: Props) {
  const { tokens } = useAppTheme();

  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-center justify-between gap-2">
        <Text variant="titleMd">Macros</Text>
        <Button
          label="Edit targets"
          variant="ghost"
          size="sm"
          accessibilityLabel="Edit daily macro targets"
          onPress={onEditTargets}
        />
      </View>
      <View className="gap-3">
        {rows.map((row) => (
          <View key={row.key}>
            <View className="mb-1 flex-row flex-wrap items-center justify-between gap-x-3">
              <Text variant="bodyMd">{row.label}</Text>
              <View className="flex-row items-center gap-2">
                <Text variant="bodyMd" style={{ color: tokens.text }}>
                  {row.actual}g / {row.target}g
                </Text>
                <Text variant="caption" tone="muted">
                  {row.over ? `${row.actual - row.target}g over` : `${row.remaining}g left`}
                </Text>
              </View>
            </View>
            <View
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: tokens.surfaceSunken }}
            >
              <View
                className="h-full rounded-full"
                style={{ width: `${row.percent}%`, backgroundColor: accentColor }}
              />
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}
