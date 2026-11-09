import { Text } from '@/core/ui/Text';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { readableAccent, tintOver } from '@/core/theme/contrast';
import { radius, spacing } from '@/core/theme/designTokens';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import type { SettingsStatusTone } from './settingsShared';

/**
 * Settings grammar (Playful Momentum §7 "Settings", keeping the W13 data
 * contract):
 * `bold group title → concise row label → current value/state → control`.
 *
 * What P18 changes is the *surface*, not the information: a Playful-Momentum
 * Settings page is a stack of `depth.flat` groups under bold `titleMd` group
 * titles, with rows carrying their own value and one optional disclosure. The
 * old section spent a caption eyebrow plus a second sentence before the first
 * control, which is the "no narration paragraphs" the brief retires.
 *
 * Row anatomy:
 * - `label`       — the setting (`bodyMd` 700).
 * - `value`       — the current value/state *data* (always visible, `caption`).
 * - `statusLabel` — a compact state pill beside the label.
 * - `explanation` — supporting prose, reachable behind one disclosure whose
 *   expanded state is exposed accessibly. Explanations are disclosed rather
 *   than deleted: several carry safety, permission, or data-consequence
 *   meaning that must stay reachable.
 *
 * Risk classes stay separate — this primitive only renders. A purely local
 * preference may apply on tap; a stored value keeps its Save affordance; a
 * destructive action keeps its own confirmation.
 */
type SettingsRowProps = {
  label: string;
  /** Current value/state data. Renders as a visible second line. */
  value?: string;
  /** Supporting prose, revealed behind the row's detail disclosure. */
  explanation?: string;
  statusLabel?: string;
  statusTone?: SettingsStatusTone;
  accentColor?: string;
  /** First row of a group: no top inset. */
  first?: boolean;
  /** Last row of a group: no hairline divider. */
  last?: boolean;
};

type SettingsSectionHeadingProps = {
  eyebrow: string;
  title: string;
  /** Hue for the eyebrow (resolved for readable text on the canvas). */
  accentColor: string;
};

/** Label of the per-row disclosure. Stable so tests can address it. */
function detailLabel(label: string, expanded: boolean): string {
  return expanded ? `Hide details for ${label}` : `Show details for ${label}`;
}

export function SettingsStatusPill({
  label,
  tone = 'neutral',
  accentColor,
}: {
  label: string;
  tone?: SettingsStatusTone;
  accentColor?: string;
}) {
  const { tokens } = useAppTheme();
  const resolvedAccentColor = accentColor ?? tokens.textMuted;

  const backgroundColor =
    tone === 'accent'
      ? `${resolvedAccentColor}18`
      : tone === 'warning'
        ? tokens.warningBackground
        : tone === 'danger'
          ? tokens.dangerBackground
          : tokens.surfaceElevated;

  // A raw accent (or the muted neutral) as small text lands under AA on the
  // pill's palette; resolve against the pill's real surface.
  const textColor =
    tone === 'accent'
      ? readableAccent(
          resolvedAccentColor,
          tintOver(tokens.surfaceElevated, resolvedAccentColor, 0.18),
          7,
        )
      : tone === 'warning'
        ? tokens.warningText
        : tone === 'danger'
          ? tokens.dangerText
          : tokens.text;

  return (
    <View
      className="rounded-full"
      style={{
        backgroundColor,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 1,
      }}
    >
      <Text variant="caption" className="font-bold" style={{ color: textColor }}>
        {label}
      </Text>
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  explanation,
  statusLabel,
  statusTone = 'neutral',
  accentColor,
  first = false,
  last = false,
}: SettingsRowProps) {
  const { tokens } = useAppTheme();
  const [showExplanation, setShowExplanation] = useState(false);
  const ring = useKeyboardFocusRing(accentColor ?? tokens.textMuted);

  return (
    <View
      style={{
        paddingTop: first ? 0 : spacing.md,
        paddingBottom: last ? 0 : spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.border,
      }}
    >
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        <Text variant="bodyMd" className="min-w-0 flex-1 font-bold">
          {label}
        </Text>
        {statusLabel ? (
          <View className="shrink-0">
            <SettingsStatusPill label={statusLabel} tone={statusTone} accentColor={accentColor} />
          </View>
        ) : null}
      </View>

      {value ? (
        <Text variant="caption" tone="muted" className="mt-1">
          {value}
        </Text>
      ) : null}

      {explanation ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailLabel(label, showExplanation)}
            accessibilityState={{ expanded: showExplanation }}
            aria-expanded={showExplanation}
            onFocus={ring.onFocus}
            onBlur={ring.onBlur}
            className="self-start justify-center"
            // The disclosure is an interactive control, so it carries the 44pt
            // touch contract even though its label is small (W14-01).
            style={[{ minHeight: 44 }, ring.focusRingStyle]}
            onPress={() => setShowExplanation((open) => !open)}
          >
            <Text variant="caption" tone="muted">
              {showExplanation ? 'Hide details −' : 'Details +'}
            </Text>
          </Pressable>
          {showExplanation ? (
            <Text variant="caption" tone="muted" className="mt-1">
              {explanation}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/**
 * Bold group title (§7 "bold `titleMd` group titles").
 *
 * The eyebrow stays because several specs address sections by it
 * (`Appearance`, `Backup / Sync / Restore`, `Notifications / Timer defaults`,
 * `Developer / Internal`, …); it is demoted to a quiet `label` overline so it
 * names the group without competing with the title. No subtitle is rendered:
 * a second explanatory sentence above the first control is exactly the
 * narration the brief removes.
 */
export function SettingsSectionHeading({
  eyebrow,
  title,
  accentColor,
}: SettingsSectionHeadingProps) {
  const { tokens } = useAppTheme();

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="label" style={{ color: readableAccent(accentColor, tokens.surface) }}>
        {eyebrow}
      </Text>
      <Text variant="titleMd" className="mt-0.5">
        {title}
      </Text>
    </View>
  );
}

/**
 * `depth.flat` group for Settings rows (§7 "rows in `depth.flat` groups").
 *
 * One static card (2px `border` ring, radius 16, no lip, no blur shadow —
 * §5.7) whose rows are separated by hairline dividers. Deliberately *not*
 * `Card`/`ListGroup`: Settings rows own their own inset and divider logic
 * (first/last flags, disclosure blocks, nested controls), and P7's
 * `ListGroup` wraps each child in a divider container that would double up.
 * Bodies stay untinted; there is no nested card.
 */
export function SettingsGroup({
  children,
  className,
  accentColor,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional hue for the group ring; at most a faint tint (§5.1 rule 2). */
  accentColor?: string;
}) {
  const { tokens } = useAppTheme();
  const borderColor = accentColor ? tintOver(tokens.border, accentColor, 0.35) : tokens.border;

  return (
    <View
      className={className}
      style={{
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor,
        backgroundColor: tokens.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      }}
    >
      {children}
    </View>
  );
}
