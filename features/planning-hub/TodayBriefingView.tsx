import { Text } from '@/core/ui/Text';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { radius, spacing } from '@/core/theme/designTokens';
import {
  buildTodayBriefing,
  type TodayBriefing,
} from '@/features/planning-hub/planningHub.briefing';
import {
  planningRowVisual,
  planningStatTileVisual,
  planningStatusVisual,
  planningToneText,
} from '@/features/planning-hub/planningHub.visual';

/**
 * One briefing tile. Static information → `depth.flat` geometry (2px outline,
 * no lip) with the Sky tint wash for the face, so the five counts read as one
 * group of quiet tiles instead of five floating cards. The value ink and the
 * caption ink are resolved against the TINT face (the §5.1 table certifies the
 * Sky solid on `tintLight` and the Sky bright on `tintDark`; a theme that
 * overrides its accents is floored the same way).
 */
function BriefingStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { tokens, resolvedTheme } = useAppTheme();
  const face = planningStatTileVisual({
    tone: warn ? 'gold' : 'sky',
    appearance: resolvedTheme,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });
  return (
    <View
      style={{
        minWidth: '45%',
        flexGrow: 1,
        flexBasis: 0,
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: face.border,
        backgroundColor: face.face,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <Text variant="caption" style={{ color: face.caption }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="titleMd" style={{ color: face.ink }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Cross-surface briefing shown at the top of the Planning Hub Today tab.
 * Read-only; pull-to-refresh via the refresh button.
 */
export function TodayBriefingView() {
  const { tokens, resolvedTheme } = useAppTheme();
  const [briefing, setBriefing] = useState<TodayBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBriefing(await buildTodayBriefing());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load briefing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const briefing = await buildTodayBriefing();
        if (active) setBriefing(briefing);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load briefing');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const danger = planningStatusVisual({
    face: tokens.dangerBackground,
    surface: tokens.surface,
    text: tokens.text,
    textMuted: tokens.textMuted,
    ink: tokens.dangerText,
    border: tokens.dangerBorder,
    solid: tokens.dangerSolid,
  });
  const secondary = planningRowVisual({
    tone: 'sky',
    selected: false,
    appearance: resolvedTheme,
    surface: tokens.surface,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.text,
    textMuted: tokens.textMuted,
  });
  const heading = planningToneText({
    tone: 'sky',
    appearance: resolvedTheme,
    surface: tokens.surface,
    text: tokens.text,
  });

  if (loading && !briefing) {
    return (
      <Text variant="bodyMd" tone="muted" style={{ paddingVertical: spacing.sm }}>
        Loading today&apos;s briefing…
      </Text>
    );
  }

  if (error || !briefing) {
    return (
      <Card>
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              borderRadius: radius.sm,
              borderWidth: 2,
              borderColor: danger.border,
              backgroundColor: danger.face,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <MaterialIcons name="error-outline" size={18} color={danger.icon} />
            <Text variant="bodyMd" style={{ color: danger.ink, flex: 1 }}>
              {error ?? 'Failed to load briefing'}
            </Text>
          </View>
          <Pressable3D
            lip={3}
            faceColor={secondary.face}
            lipColor={secondary.lip}
            radius={radius.md}
            onPress={() => void refresh()}
            accessibilityRole="button"
            accessibilityLabel="Retry briefing"
            faceStyle={{ borderWidth: 2, borderColor: secondary.border }}
            contentStyle={{
              minHeight: 44,
              paddingHorizontal: spacing.lg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="button" style={{ color: tokens.text }}>
              Retry
            </Text>
          </Pressable3D>
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleMd" style={{ color: heading }}>
          Today&apos;s briefing
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh briefing"
          onPress={() => void refresh()}
          disabled={loading}
          style={{
            minHeight: 44,
            minWidth: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="refresh" size={20} color={secondary.mark} />
          <Text variant="caption" style={{ color: secondary.mark }}>
            {loading ? '…' : 'Refresh'}
          </Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <BriefingStat
          label="Overdue todos"
          value={String(briefing.overdueTodoCount)}
          warn={briefing.overdueTodoCount > 0}
        />
        <BriefingStat label="Due today" value={String(briefing.dueTodayTodoCount)} />
        <BriefingStat
          label="Plan progress"
          value={
            briefing.planProgress
              ? `${briefing.planProgress.done}/${briefing.planProgress.total}`
              : 'No plan yet'
          }
        />
        <BriefingStat
          label="Projects · Goals"
          value={`${briefing.activeProjectCount} · ${briefing.activeGoalCount}`}
        />
        <BriefingStat label="Yesterday focus" value={`${briefing.yesterdayFocusMinutes} min`} />
      </View>
    </View>
  );
}
