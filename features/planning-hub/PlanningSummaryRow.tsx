import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Text } from '@/core/ui/Text';
import { ProgressBar } from '@/core/ui/ProgressBar';
import { radius, spacing } from '@/core/theme/designTokens';
import { planningRowVisual } from '@/features/planning-hub/planningHub.visual';

/** W11: one objective / status / context / progress grammar for planning.
 * Visual layout is shared; goal and project persistence stays in its owner. */
type Props = {
  title: string;
  status: string;
  context?: string | null;
  targetDate?: string | null;
  progressPercent: number;
  accentColor: string;
  accessibilityLabel: string;
  onPress: () => void;
  actions?: ReactNode;
};

/**
 * Shared objective row (projects + goals). v2 P21 part A brings it onto the
 * v2 tokens: the whole non-action surface is ONE press target (`depth.card`
 * recipe — 2px ring + a 4px `borderStrong` bottom lip), the progress line rides
 * the shared `ProgressBar` (sunken track + section bright fill; slimmed to 8px
 * so the row keeps its 52pt rhythm), and the percentage sits on the row's own
 * ink tier instead of a second color system.
 *
 * Accessibility is unchanged: the press target keeps its long
 * "name, status, N percent progress" label, and the reorder actions stay
 * independent siblings (W11.5 pins that pressing them never opens the detail).
 */
export function PlanningSummaryRow({
  title,
  status,
  context,
  targetDate,
  progressPercent,
  accentColor,
  accessibilityLabel,
  onPress,
  actions,
}: Props) {
  const { tokens, resolvedTheme } = useAppTheme();
  const percent = Math.max(
    0,
    Math.min(100, Number.isFinite(progressPercent) ? progressPercent : 0),
  );
  // The row is a surface card, not a selected option: `planningRowVisual` with
  // `selected: false` yields (surface face, floored outline, `borderStrong`
  // lip, theme ink) — the exact `depth.card` colors, hue-independent so a
  // project's own color never becomes text.
  const row = planningRowVisual({
    tone: 'sky',
    selected: false,
    appearance: resolvedTheme,
    surface: tokens.surface,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });

  return (
    <View
      style={{
        borderRadius: radius.lg,
        backgroundColor: row.face,
        borderWidth: 2,
        borderColor: row.border,
        borderBottomWidth: 4,
        borderBottomColor: row.lip,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={{
            minHeight: 52,
            minWidth: 0,
            flex: 1,
            justifyContent: 'center',
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.sm,
            gap: spacing.xs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text
                variant="bodyMd"
                style={{ color: row.ink, fontWeight: '700' }}
                numberOfLines={2}
              >
                {title}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>
                {status}
                {context ? ` · ${context}` : ''}
                {targetDate ? ` · Due ${targetDate}` : ''}
              </Text>
            </View>
            <Text
              variant="label"
              style={{ color: row.ink }}
              accessibilityLabel={`${percent} percent progress`}
            >
              {percent}%
            </Text>
          </View>
          <ProgressBar
            progress={percent / 100}
            accentColor={accentColor}
            height={8}
            style={{ marginTop: spacing.xs }}
          />
        </Pressable>
        {actions ? (
          <View style={{ paddingRight: spacing.sm, flexDirection: 'row', gap: spacing.xs }}>
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
}
