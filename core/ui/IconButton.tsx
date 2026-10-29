import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Pressable3D } from '@/core/ui/Pressable3D';

function withAlpha(color: string, opacity: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

type IconButtonProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  accentColor?: string;
  size?: number;
  /**
   * `raised` (default) = the §6 slab: 44×44 face + 2px lip, white face, 2px
   * border, radius 14. `flat` = no lip for header actions (the lip band is
   * transparent; press feedback is kept).
   */
  variant?: 'raised' | 'flat';
};

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  selected = false,
  accentColor,
  size = 22,
  variant = 'raised',
}: IconButtonProps) {
  const { tokens } = useAppTheme();
  const resolvedAccent = accentColor ?? tokens.iconMuted;

  return (
    <Pressable3D
      lip={2}
      faceColor={selected ? withAlpha(resolvedAccent, 0.12) : tokens.surface}
      lipColor={
        variant === 'flat'
          ? 'transparent'
          : selected
            ? withAlpha(resolvedAccent, 0.28)
            : tokens.borderStrong
      }
      radius={14}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      className="h-11 w-11 items-center justify-center border-2"
      contentStyle={{
        borderColor: selected ? withAlpha(resolvedAccent, 0.28) : tokens.border,
      }}
    >
      <MaterialIcons name={icon} size={size} color={selected ? resolvedAccent : tokens.iconMuted} />
    </Pressable3D>
  );
}
