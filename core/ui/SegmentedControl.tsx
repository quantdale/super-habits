import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';

type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accent color for the selected segment; defaults to the theme accent. */
  accentColor?: string;
  accessibilityLabel?: string;
};

/**
 * Additive shared primitive: a small segmented control for switching between
 * 2–4 mutually exclusive modes (e.g. Form / Diary).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { tokens } = useAppTheme();
  const resolvedAccent = accentColor ?? tokens.accent;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row rounded-2xl border p-1"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center rounded-xl px-3 py-2"
            style={active ? { backgroundColor: resolvedAccent } : undefined}
          >
            <Text
              className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}
              style={active ? { color: tokens.textOnAccent } : { color: tokens.textMuted }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
