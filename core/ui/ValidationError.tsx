import { Text } from '@/core/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';

type Props = {
  message: string | null;
};

export function ValidationError({ message }: Props) {
  const { tokens } = useAppTheme();

  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: tokens.dangerBackground,
        borderRadius: radius.xs,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: tokens.dangerBorder,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {/* Decorative glyph: `label` scale, no product text. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        <MaterialIcons name="error-outline" size={18} color={tokens.dangerText} />
      </View>
      <Text variant="bodyMd" style={{ color: tokens.dangerText, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
