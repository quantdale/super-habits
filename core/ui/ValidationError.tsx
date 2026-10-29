import { Text } from '@/core/ui/Text';
import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { typography } from '@/core/theme/designTokens';

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
        borderRadius: 8,
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
      <Text style={{ ...typography.label }}>⚠️</Text>
      <Text variant="bodyMd" style={{ color: tokens.dangerText, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
