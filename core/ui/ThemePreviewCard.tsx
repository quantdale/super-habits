import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useAppTheme } from '@/core/providers/themeContext';
import type { ThemeDefinition } from '@/core/theme';
import { radius, spacing } from '@/core/theme/designTokens';

/**
 * Live theme mini-preview (Playful Momentum §7 Settings: "Theme picker =
 * OptionRows with live mini-previews").
 *
 * The old card was a 104px tile in a wrapping grid: two per row at best, a
 * separate selection ring, and its own name/appearance caption repeated beside
 * the OptionRow that now carries the label. This renders the *preview only* —
 * a self-contained swatch painted entirely from the **previewed theme's own
 * tokens** (`theme.tokens`), so the picker previews a theme without switching
 * to it:
 *
 * - the canvas (`background`) with a 2px `border` ring;
 * - a small `surface` card outlined by the previewed `border`;
 * - two text bars in `text` / `textMuted`;
 * - a `primary` dot (the theme's brand mark);
 * - a `button` + `buttonText` mini button, which is the one part a user is
 *   most likely to judge ("is this button readable here?") and it carries the
 *   theme's own contrast promise (§5.4 `buttonText` on `button` ≥ 4.5).
 *
 * Because every fill comes from the previewed theme, the swatch is decorative:
 * it is hidden from assistive tech (`accessibilityElementsHidden` /
 * `aria-hidden`) and the surrounding `OptionRow` supplies the accessible name,
 * so no new string is introduced and the name asserted by `theming.spec.ts`
 * (`<Theme>, <light|dark> theme`) is unchanged.
 */
type ThemePreviewCardProps = {
  theme: ThemeDefinition;
  /** Selection is owned by the surrounding OptionRow; kept for API parity. */
  selected?: boolean;
  /** The preview is presentational; pressing is handled by the row. */
  onPress?: () => void;
  /** Compact swatch used inline in list rows. */
  size?: 'row';
};

const SWATCH_WIDTH = 64;
const SWATCH_HEIGHT = 40;

export function ThemePreviewCard({ theme, selected = false }: ThemePreviewCardProps) {
  const { tokens: activeTokens } = useAppTheme();
  const t = theme.tokens;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      aria-hidden
      style={{
        width: SWATCH_WIDTH,
        height: SWATCH_HEIGHT,
        borderRadius: radius.sm,
        borderWidth: 2,
        // The active theme's border keeps the swatch legible even when the
        // previewed theme's own border is nearly the same tone as its canvas.
        borderColor: selected ? activeTokens.primary : activeTokens.border,
        backgroundColor: t.background,
        overflow: 'hidden',
        padding: spacing.xs,
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: radius.full,
            backgroundColor: t.primary,
          }}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <View
            style={{
              height: 4,
              borderRadius: radius.full,
              backgroundColor: t.text,
              width: '80%',
            }}
          />
          <View
            style={{
              height: 3,
              borderRadius: radius.full,
              backgroundColor: t.textMuted,
              width: '55%',
            }}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 12,
            borderRadius: radius.xs,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.border,
          }}
        />
        <View
          style={{
            width: 26,
            height: 12,
            borderRadius: radius.xs,
            backgroundColor: t.button,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons
            accessibilityElementsHidden
            importantForAccessibility="no"
            name="check"
            size={9}
            color={t.buttonText}
          />
        </View>
      </View>
    </View>
  );
}
