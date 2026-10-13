import { Text } from '@/core/ui/Text';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { readableAccent, tintOver } from '@/core/theme/contrast';
import { spacing } from '@/core/theme/designTokens';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import type { SettingsStatusTone } from './settingsShared';

/**
 * W13 Settings grammar (design D13.1):
 * `group heading → concise label → current value/state → control or detail`.
 *
 * The Pop-era row required a prose `description` on every setting, so
 * explanation — not the control — dominated the surface (`SUR-08`) and the
 * current value was often restated in separate rows as well. The row now
 * separates three things that used to be conflated:
 *
 * - `value`       — the current value/state *data* (always visible);
 * - `statusLabel` — a compact state pill beside the label;
 * - `explanation` — supporting prose, reachable behind one disclosure whose
 *                   expanded state is exposed accessibly.
 *
 * Explanations are disclosed rather than deleted: several carry safety,
 * permission, or data-consequence meaning that must stay reachable.
 *
 * Risk classes stay separate (design D13.2) — this primitive only renders. A
 * purely local preference may apply on tap; a stored value keeps its Save
 * affordance; a destructive action keeps its own confirmation.
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
  first?: boolean;
  last?: boolean;
};

type SettingsSectionHeadingProps = {
  eyebrow: string;
  title: string;
  /** Optional one-line context. Kept for call sites that still pass it. */
  subtitle?: string;
  /** Accepted for API compatibility; the V3 heading no longer renders an icon tile. */
  icon?: string;
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

  // A raw accent (or the muted neutral) as 11px uppercase text lands under AA
  // on the pill's palette; resolve against the pill's real surface.
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
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor }}>
      <Text
        className="text-[11px] font-semibold uppercase tracking-[1px]"
        style={{ color: textColor }}
      >
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
      className={[!first ? 'pt-3' : '', !last ? 'border-b pb-3' : ''].filter(Boolean).join(' ')}
      style={!last ? { borderColor: tokens.border } : undefined}
    >
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
        <Text className="min-w-0 flex-1 text-sm font-semibold" style={{ color: tokens.text }}>
          {label}
        </Text>
        {statusLabel ? (
          <View className="shrink-0">
            <SettingsStatusPill label={statusLabel} tone={statusTone} accentColor={accentColor} />
          </View>
        ) : null}
      </View>

      {value ? (
        <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
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
            className="mt-1 self-start"
            style={[{ minHeight: 32 }, ring.focusRingStyle]}
            onPress={() => setShowExplanation((open) => !open)}
          >
            <Text className="text-xs" style={{ color: tokens.textMuted }}>
              {showExplanation ? 'Hide details −' : 'Details +'}
            </Text>
          </Pressable>
          {showExplanation ? (
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              {explanation}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/**
 * Quiet group heading (design D13.1): a caption eyebrow plus a short title on
 * the canvas. The Pop-era heading spent an icon tile, an uppercase eyebrow, a
 * 20px title and a subtitle sentence before the first control, so the first
 * fold held no controllable preference (`W13-03`).
 */
export function SettingsSectionHeading({
  eyebrow,
  title,
  accentColor,
}: SettingsSectionHeadingProps) {
  const { tokens } = useAppTheme();

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text
        className="text-[11px] font-semibold uppercase tracking-[1.2px]"
        style={{ color: readableAccent(accentColor, tokens.surfaceElevated) }}
      >
        {eyebrow}
      </Text>
      <Text className="mt-1 text-base font-semibold" style={{ color: tokens.text }}>
        {title}
      </Text>
    </View>
  );
}
