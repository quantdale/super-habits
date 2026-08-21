import { MaterialIcons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { EmptyStateCard } from '@/core/ui/EmptyStateCard';
import { Modal } from '@/core/ui/Modal';
import { dateKeyToLocalDate, toDateKey } from '@/lib/time';
import type { DailySummary } from './types';

const COLOR_FALLBACK = '#888';

function addDays(dateKey: string, days: number): string {
  const d = dateKeyToLocalDate(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function shortWeekday(dateKey: string): string {
  return dateKeyToLocalDate(dateKey).toLocaleDateString('en-US', { weekday: 'narrow' });
}

function dayNumber(dateKey: string): number {
  return dateKeyToLocalDate(dateKey).getDate();
}

function formatNavLabel(dateKey: string): string {
  const d = dateKeyToLocalDate(dateKey);
  const today = toDateKey();
  if (dateKey === today) return 'Today';
  if (dateKey === addDays(today, -1)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Monday-start calendar week containing `selectedDateKey`.
 */
function buildWeekStrip(selectedDateKey: string): string[] {
  const selected = dateKeyToLocalDate(selectedDateKey);
  const weekdayMonday = (selected.getDay() + 6) % 7;
  const monday = new Date(selected);
  monday.setDate(selected.getDate() - weekdayMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateKey(d);
  });
}

type Props = {
  visible: boolean;
  summaries: DailySummary[];
  targetDateKey: string;
  onCopy: (sourceDateKey: string) => void;
  onClose: () => void;
};

/** Pick a previous logged day to duplicate into the diary's selected day. */
export function CopyDayModal({ visible, summaries, targetDateKey, onCopy, onClose }: Props) {
  const { tokens } = useAppTheme();

  const candidates = useMemo(() => {
    const today = toDateKey();
    return summaries
      .filter((s) => s.totalCalories > 0 && s.dateKey < targetDateKey && s.dateKey <= today)
      .slice(-14)
      .reverse();
  }, [summaries, targetDateKey]);

  return (
    <Modal title="Copy a previous day" visible={visible} onClose={onClose} scroll>
      <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
        Copies every entry from the chosen day into {formatNavLabel(targetDateKey).toLowerCase()} as
        new entries.
      </Text>
      {candidates.length === 0 ? (
        <EmptyStateCard
          accentColor={COLOR_FALLBACK}
          title="No earlier logged days"
          description="Log food on a previous day first, then copy it here."
        />
      ) : (
        <View className="gap-2 pb-2">
          {candidates.map((summary) => (
            <Pressable
              key={summary.dateKey}
              onPress={() => {
                onCopy(summary.dateKey);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Copy ${formatNavLabel(summary.dateKey)} into ${formatNavLabel(targetDateKey)}`}
              className="flex-row items-center justify-between rounded-2xl border px-4 py-3"
              style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
            >
              <Text className="text-sm font-medium" style={{ color: tokens.text }}>
                {formatNavLabel(summary.dateKey)}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-xs" style={{ color: tokens.textMuted }}>
                  {Math.round(summary.totalCalories)} kcal
                </Text>
                <MaterialIcons name="content-copy" size={16} color={tokens.textMuted} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Modal>
  );
}

export function CopyDayButton({ onPress }: { onPress: () => void }) {
  return <Button label="Copy a previous day" variant="ghost" onPress={onPress} />;
}

type NavigatorProps = {
  selectedDateKey: string;
  summaries: DailySummary[];
  onSelectDate: (dateKey: string) => void;
  onCopyDay: () => void;
};

/**
 * Diary day navigation: prev/next buttons, a Monday-start week strip with
 * logged-day dots, and a per-day totals header. Informational only.
 */
export function DiaryDayNavigator({
  selectedDateKey,
  summaries,
  onSelectDate,
  onCopyDay,
}: NavigatorProps) {
  const { tokens, sectionAccents } = useAppTheme();
  const colorText = sectionAccents.calories.text;
  const today = toDateKey();

  const weekStrip = useMemo(() => buildWeekStrip(selectedDateKey), [selectedDateKey]);
  const loggedDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of summaries) {
      if (s.totalCalories > 0) set.add(s.dateKey);
    }
    return set;
  }, [summaries]);

  const selectedSummary = summaries.find((s) => s.dateKey === selectedDateKey);

  return (
    <Card
      variant="header"
      accentColor={sectionAccents.calories.tint}
      headerTitle={formatNavLabel(selectedDateKey)}
      headerSubtitle={
        selectedSummary
          ? `${Math.round(selectedSummary.totalCalories)} kcal · P ${Math.round(selectedSummary.totalProtein)}g · C ${Math.round(selectedSummary.totalCarbs)}g · F ${Math.round(selectedSummary.totalFats)}g`
          : 'No entries logged on this day.'
      }
      className="mb-0"
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Pressable
          onPress={() => onSelectDate(addDays(selectedDateKey, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          className="h-10 w-10 items-center justify-center rounded-xl border"
          style={{ borderColor: tokens.border }}
        >
          <MaterialIcons name="chevron-left" size={20} color={tokens.text} />
        </Pressable>
        <Pressable
          onPress={() => onSelectDate(today)}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          disabled={selectedDateKey === today}
          className="rounded-full px-3 py-1.5"
          style={{ opacity: selectedDateKey === today ? 0.4 : 1 }}
        >
          <Text className="text-xs font-semibold" style={{ color: colorText }}>
            Today
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onSelectDate(addDays(selectedDateKey, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          disabled={selectedDateKey >= today}
          className="h-10 w-10 items-center justify-center rounded-xl border"
          style={{ borderColor: tokens.border, opacity: selectedDateKey >= today ? 0.4 : 1 }}
        >
          <MaterialIcons name="chevron-right" size={20} color={tokens.text} />
        </Pressable>
      </View>

      <View className="mb-3 flex-row justify-between">
        {weekStrip.map((dateKey) => {
          const isSelected = dateKey === selectedDateKey;
          const isFuture = dateKey > today;
          const logged = loggedDays.has(dateKey);
          return (
            <Pressable
              key={dateKey}
              onPress={() => !isFuture && onSelectDate(dateKey)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${formatNavLabel(dateKey)}`}
              accessibilityState={{ selected: isSelected }}
              disabled={isFuture}
              className="items-center gap-1 rounded-xl px-2 py-1.5"
              style={[
                { minWidth: 38 },
                isSelected ? { backgroundColor: sectionAccents.calories.tint } : null,
              ]}
            >
              <Text
                className="text-[10px] font-medium uppercase"
                style={{ color: isFuture ? tokens.textMuted : tokens.textMuted }}
              >
                {shortWeekday(dateKey)}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{
                  color: isFuture ? tokens.textMuted : isSelected ? colorText : tokens.text,
                }}
              >
                {dayNumber(dateKey)}
              </Text>
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: logged ? colorText : 'transparent',
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <CopyDayButton onPress={onCopyDay} />
    </Card>
  );
}
