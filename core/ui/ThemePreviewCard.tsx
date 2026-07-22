import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import type { ThemeDefinition } from '@/core/theme';

type ThemePreviewCardProps = {
  theme: ThemeDefinition;
  selected: boolean;
  onPress: () => void;
};

/** A ~72x56 swatch rendered from the theme's own tokens, plus name + appearance badge. */
export function ThemePreviewCard({ theme, selected, onPress }: ThemePreviewCardProps) {
  const { tokens: activeTokens } = useAppTheme();
  const t = theme.tokens;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${theme.name}, ${theme.appearance} theme`}
      onPress={onPress}
      className="w-[104px] items-center gap-2 rounded-2xl p-2"
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? activeTokens.primary : activeTokens.border,
        backgroundColor: activeTokens.surface,
      }}
    >
      <View
        className="h-14 w-[72px] overflow-hidden rounded-xl"
        style={{ backgroundColor: t.background }}
      >
        <View
          className="absolute bottom-1.5 left-1.5 right-1.5 rounded-lg p-1.5"
          style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 }}
        >
          <View className="h-1 w-7 rounded-full" style={{ backgroundColor: t.text }} />
          <View className="mt-1 h-1 w-5 rounded-full" style={{ backgroundColor: t.textMuted }} />
        </View>
        <View
          className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: t.primary }}
        />
        {selected ? (
          <View
            className="absolute left-1.5 top-1.5 h-4 w-4 items-center justify-center rounded-full"
            style={{ backgroundColor: activeTokens.primary }}
          >
            <MaterialIcons name="check" size={12} color={t.buttonText} />
          </View>
        ) : null}
      </View>
      <View className="items-center">
        <Text
          className="text-xs font-semibold"
          numberOfLines={1}
          style={{ color: activeTokens.text }}
        >
          {theme.name}
        </Text>
        <Text
          className="text-[10px] uppercase tracking-[0.5px]"
          style={{ color: activeTokens.iconMuted }}
        >
          {theme.appearance}
        </Text>
      </View>
    </Pressable>
  );
}
