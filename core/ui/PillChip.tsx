import React from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { spacing, radius, size } from '@/core/theme/designTokens';

type Props = {
  label: string;
  accessibilityLabel?: string;
  active: boolean;
  color: string; // section accent color
  onPress: () => void;
  icon?: string; // optional emoji or text prefix
};

export function PillChip({ label, accessibilityLabel, active, color, onPress, icon }: Props) {
  const { tokens } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      className="mb-2 mr-2 flex-row items-center gap-1"
      style={{
        borderRadius: radius.full,
        borderWidth: 1,
        paddingHorizontal: spacing.lg - 2,
        paddingVertical: spacing.sm,
        minHeight: size.touchTargetMin - 4,
        ...(active
          ? {
              backgroundColor: color,
              borderColor: color,
            }
          : {
              borderColor: tokens.border,
              backgroundColor: tokens.surfaceElevated,
            }),
      }}
    >
      {icon ? <Text className="text-[13px]">{icon}</Text> : null}
      <Text
        className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}
        style={active ? { color: tokens.textOnAccent } : { color: tokens.textMuted }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
