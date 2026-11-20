import { Text } from '@/core/ui/Text';
import { Platform, Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';

type Props = {
  onEdit: () => void;
  onDelete: () => void;
  editColor: string;
  compact?: boolean;
  /** Closed gesture panels must not expose offscreen web tab stops. */
  visible?: boolean;
};

export function SwipeRightActions({
  onEdit,
  onDelete,
  editColor,
  compact,
  visible = false,
}: Props) {
  const { tokens } = useAppTheme();
  const editFocus = useKeyboardFocusRing(tokens.accent);
  const deleteFocus = useKeyboardFocusRing(tokens.accent);
  // These full-height actions sit inside Swipeable's clipping viewport. Keep
  // the web keyboard outline inside the face so every edge remains visible.
  const insetRing = Platform.OS === 'web' ? { outlineOffset: -4 } : undefined;
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
        tabIndex={Platform.OS === 'web' ? (visible ? 0 : -1) : undefined}
        aria-hidden={Platform.OS === 'web' ? !visible : undefined}
        onFocus={editFocus.onFocus}
        onBlur={editFocus.onBlur}
        style={[actionStyle, { backgroundColor: editColor }, editFocus.focusRingStyle, insetRing]}
      >
        <Text variant="label" style={{ color: tokens.textOnAccent }}>
          Edit
        </Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="Delete item"
        tabIndex={Platform.OS === 'web' ? (visible ? 0 : -1) : undefined}
        aria-hidden={Platform.OS === 'web' ? !visible : undefined}
        onFocus={deleteFocus.onFocus}
        onBlur={deleteFocus.onBlur}
        style={[
          actionStyle,
          { backgroundColor: tokens.dangerSolid },
          deleteFocus.focusRingStyle,
          insetRing,
        ]}
      >
        <Text variant="label" style={{ color: tokens.textOnAccent }}>
          Delete
        </Text>
      </Pressable>
    </View>
  );
}
