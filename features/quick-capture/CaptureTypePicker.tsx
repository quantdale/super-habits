import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { Text } from '@/core/ui/Text';
import { usePressDepth } from '@/core/ui/motion/usePressDepth';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
import { HERO_ICONS } from '@/core/ui/illustrations/icons';
import { resolveCaptureAccent } from './captureType.mode';
import {
  CAPTURE_TYPE_OPTIONS,
  TILE_LIP,
  TILE_MIN_HEIGHT,
  captureTypeTileVisual,
  type CaptureTypeKey,
  type CaptureTypeTileVisual,
} from './captureType.visual';

/**
 * Quick capture destination picker (P19, docs/ui-ux/16-playful-momentum.md
 * §7 "Command Center + Quick capture" + §6 OptionRow).
 *
 * Six OptionRow-style tiles with the P9 duotone hero icons. Idle tiles are
 * neutral (surface face, sunken icon chip); the selected tile takes its
 * destination's section hue — tint face, 2px solid border, solid lip, hue-filled
 * icon chip and a trailing check — so exactly one hue is visible at a time
 * (never a rainbow row, §4 rule 2). Planning destinations (Project/Goal) own no
 * section and keep the theme accent, as the pre-P19 type chips did.
 *
 * Contracts kept: the six product labels (Task/Habit/Calorie/Project/Goal/
 * Focus), the `button` role every existing spec selects by
 * (`getByRole('button', { name: 'Calorie' })`), and the toggle semantics
 * (`accessibilityState.selected` for native + `aria-pressed` for web, exactly
 * what `Chip` does — this react-native-web version does not map
 * `accessibilityState` to the DOM). Selection is therefore carried by four
 * independent visual properties as well, so it never depends on hue alone.
 *
 * Layout: 3 columns on a phone (two rows) and 6 in one row once the sheet is
 * wide enough, so no label truncates at 360/375/390 and every target clears
 * 44pt (§5.6 "big and forgiving").
 */
export function CaptureTypePicker({
  modes,
  selected,
  onSelect,
}: {
  modes: readonly { key: CaptureTypeKey; label: string }[];
  selected: CaptureTypeKey;
  onSelect: (key: CaptureTypeKey) => void;
}) {
  const { tokens, resolvedTheme, sectionAccents } = useAppTheme();
  const { width } = useWindowDimensions();
  const columns = width >= 480 ? 6 : 3;

  return (
    <View
      // Single-choice group; individual tiles keep the `button` role.
      accessibilityLabel="Capture type"
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {modes.map((mode) => {
        const option = CAPTURE_TYPE_OPTIONS.find((candidate) => candidate.key === mode.key);
        const Icon = option ? HERO_ICONS[option.icon] : null;
        const accent = resolveCaptureAccent(mode.key, tokens, sectionAccents);
        const visual = captureTypeTileVisual({
          selected: selected === mode.key,
          accent,
          appearance: resolvedTheme,
          surface: tokens.surface,
          surfaceSunken: tokens.surfaceSunken,
          border: tokens.border,
          borderStrong: tokens.borderStrong,
          text: tokens.text,
          textMuted: tokens.textMuted,
          iconMuted: tokens.iconMuted,
        });

        return (
          <CaptureTypeTile
            key={mode.key}
            label={mode.label}
            selected={visual.selected}
            visual={visual}
            columns={columns}
            onPress={() => onSelect(mode.key)}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.xs,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: visual.iconChipFace,
              }}
            >
              {Icon ? <Icon size={24} bright={visual.iconBright} lip={visual.iconLip} /> : null}
            </View>
            <Text
              variant="label"
              numberOfLines={1}
              style={{ color: visual.labelInk, textAlign: 'center' }}
            >
              {mode.label}
            </Text>
            {visual.selected ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{ position: 'absolute', top: 5, right: 5 }}
              >
                <MaterialIcons name="check" size={14} color={visual.badgeInk} />
              </View>
            ) : null}
          </CaptureTypeTile>
        );
      })}
    </View>
  );
}

/**
 * One tile: the §5.7 lip slab (`Pressable3D`'s exact structure — outer lip
 * `View`, face on a `marginBottom: lip` band, face travelling by `lip` on
 * press), built locally because the shared primitive forwards a fixed prop set
 * with no toggle-state slot and web assistive tech needs `aria-pressed` on the
 * interactive node itself.
 */
function CaptureTypeTile({
  label,
  selected,
  visual,
  columns,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  visual: CaptureTypeTileVisual;
  columns: number;
  onPress: () => void;
  children: ReactNode;
}) {
  const { tokens } = useAppTheme();
  const focusRing = useKeyboardFocusRing(tokens.accent);
  const { onPressIn, onPressOut, animatedStyle } = usePressDepth({ lip: TILE_LIP });

  return (
    <View
      style={{
        flexBasis: `${columns === 6 ? 15 : 30}%`,
        flexGrow: 1,
        minWidth: 0,
        backgroundColor: visual.lipColor,
        borderRadius: radius.md,
      }}
    >
      <Animated.View
        style={[
          {
            marginBottom: TILE_LIP,
            borderRadius: radius.md,
            backgroundColor: visual.face,
            borderWidth: visual.borderWidth,
            borderColor: visual.borderColor,
          },
          animatedStyle,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onFocus={focusRing.onFocus}
          onBlur={focusRing.onBlur}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected }}
          aria-pressed={selected}
          style={[
            {
              minHeight: TILE_MIN_HEIGHT,
              borderRadius: radius.md,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.xs,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs + 2,
            },
            focusRing.focusRingStyle,
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
