import { Platform, Pressable, Switch as NativeSwitch, View, type SwitchProps } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, size } from '@/core/theme/designTokens';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useSpaceActivation } from '@/core/ui/useSpaceActivation';

type Props = Pick<
  SwitchProps,
  'accessibilityLabel' | 'value' | 'disabled' | 'onValueChange' | 'trackColor'
>;

/** Native switch unchanged; web gets a real hit box around its compact track. */
export function BooleanSwitch(props: Props) {
  const { value = false, disabled = false, accessibilityLabel, onValueChange, trackColor } = props;
  const { tokens } = useAppTheme();
  const focus = useKeyboardFocusRing(tokens.accent);
  const activate = () => {
    void onValueChange?.(!value);
  };
  const ref = useSpaceActivation({
    role: 'switch',
    onActivate: activate,
    disabled,
    includeEnter: true,
  });

  if (Platform.OS !== 'web') return <NativeSwitch {...props} />;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      disabled={disabled}
      onPress={activate}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        {
          width: size.webTouchTargetMin,
          height: size.webTouchTargetMin,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.full,
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        },
        focus.focusRingStyle,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          width: 40,
          height: 22,
          padding: 1,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: tokens.borderStrong,
          backgroundColor: value
            ? (trackColor?.true ?? tokens.primary)
            : (trackColor?.false ?? tokens.surfaceSunken),
          alignItems: value ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
        }}
      >
        <View
          style={{ width: 18, height: 18, borderRadius: radius.full, backgroundColor: tokens.text }}
        />
      </View>
    </Pressable>
  );
}
