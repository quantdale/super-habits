import { Text } from '@/core/ui/Text';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  editColor: string;
  compact?: boolean;
};

export function SwipeRightActions({ onEdit, onDelete, editColor, compact }: Props) {
  const { tokens } = useAppTheme();
  const btnWidth = compact ? 56 : 80;
  const actionStyle = {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    width: btnWidth,
    alignSelf: 'stretch' as const,
    // Matches `Card`'s `radius.lg` (v2 §5.6) so the revealed action continues
    // the row's corner instead of cutting a tighter arc behind it.
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tokens.border,
    shadowColor: tokens.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        alignSelf: 'stretch',
        height: '100%',
        marginLeft: 4,
        gap: 4,
      }}
    >
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel="Edit item"
        style={[actionStyle, { backgroundColor: editColor }]}
      >
        <Text variant="label" style={{ color: tokens.textOnAccent }}>
          Edit
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
        style={[actionStyle, { backgroundColor: tokens.dangerSolid }]}
      >
        <Text variant="label" style={{ color: tokens.textOnAccent }}>
          Delete
        </Text>
      </Pressable>
    </View>
  );
}
