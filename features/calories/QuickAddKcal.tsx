import { Text } from '@/core/ui/Text';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Pressable3D } from '@/core/ui/Pressable3D';
import { SectionLabel } from '@/core/ui/SectionLabel';
import { radius, spacing, typography } from '@/core/theme/designTokens';
import { readableAccent } from '@/core/theme/contrast';
import { createSubmitGuard } from '@/lib/submitGuard';

/** Same upper bound as the macro-form kcal validation (lib/validation.ts). */
const MAX_QUICK_ADD_KCAL = 9999;

/** One-tap kcal presets rendered as chunky chips above the manual input. */
const QUICK_ADD_PRESETS = [100, 200, 300, 500] as const;

/** §6 compact face (36) with vertical slop lifting the target to ≥44. */
const PRESET_FACE_HEIGHT = 36;
const PRESET_TOUCH_SLOP = 4;

/**
 * Compact kcal-only logger shown next to the recent/frequent chips
 * (Playful Momentum P17: the quick kcal amounts are `sm` Pressable3D buttons).
 *
 * calorie_entries stores an explicit calories column, so a zero-macro entry
 * needs no fabricated macros and no migration; `onSubmit` writes through the
 * existing create path (same sync/backup intents as the full form).
 *
 * The presets are secondary pressables in the §6 sense: white face + 2px
 * `border` + `borderStrong` lip, with the section accent as the label ink —
 * `accentColor` here is the text-safe Berry tier (`caloriesHeroVisual
 * .segmentedAccent`), because the raw §5.1 `bright` fill reads 2.58:1 on a
 * white face. Accessible names (`Quick add 200 kilocalories`) are unchanged.
 */
export function QuickAddKcal({
  onSubmit,
  accentColor,
}: {
  onSubmit: (kcal: number) => Promise<void>;
  /** Text-safe Berry tier for the preset labels (see the doc comment). */
  accentColor: string;
}) {
  const { tokens } = useAppTheme();
  // The preset face is the theme surface, so the section accent is resolved for
  // THAT fill: the raw §5.1 `bright` Berry reads 2.58:1 on a white face while
  // the nudged tier reads 5.15:1 there (and `bright` stays 6.38:1 in dark).
  const presetInk = readableAccent(accentColor, tokens.surface);
  const [kcalText, setKcalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Synchronous re-entry guard: React state updates are async, so two chip
  // (or Add-button) presses in the same tick would both pass a `saving`
  // check and log two entries (CG-3 defect class). Both entry paths funnel
  // through `saveKcal`, so one shared guard covers chips and manual Add.
  // `saving` stays for the Add-button `loading` UI only.
  const submitGuardRef = useRef(createSubmitGuard());

  const saveKcal = (kcal: number) => {
    if (!submitGuardRef.current.tryStart()) return;
    setError(null);
    setSaving(true);
    void (async () => {
      try {
        await onSubmit(kcal);
        setKcalText('');
      } catch {
        setError('Could not save entry.');
      } finally {
        submitGuardRef.current.finish();
        setSaving(false);
      }
    })();
  };

  const handleSubmit = () => {
    const parsed = Number(kcalText.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError('Enter whole calories greater than zero.');
      return;
    }
    if (parsed > MAX_QUICK_ADD_KCAL) {
      setError('Calories cannot exceed 9999 kcal.');
      return;
    }
    saveKcal(parsed);
  };

  return (
    <View className="mb-3">
      <View className="mb-1.5">
        <SectionLabel className="mb-0">Quick add calories</SectionLabel>
      </View>
      <View className="mb-2 flex-row flex-wrap" style={{ gap: spacing.sm }}>
        {QUICK_ADD_PRESETS.map((preset) => (
          <Pressable3D
            key={preset}
            lip={2}
            faceColor={tokens.surface}
            lipColor={tokens.borderStrong}
            radius={radius.sm}
            onPress={() => saveKcal(preset)}
            accessibilityRole="button"
            accessibilityLabel={`Quick add ${preset} kilocalories`}
            accessibilityState={{ disabled: false }}
            hitSlop={{ top: PRESET_TOUCH_SLOP, bottom: PRESET_TOUCH_SLOP }}
            faceStyle={{ borderWidth: 2, borderColor: tokens.border }}
            contentStyle={{
              minHeight: PRESET_FACE_HEIGHT,
              minWidth: 56,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ ...typography.label, color: presetInk }}>{preset}</Text>
          </Pressable3D>
        ))}
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="Quick add calories"
          className="min-h-[48px] flex-1 rounded-2xl border px-4 text-sm"
          keyboardType="number-pad"
          onChangeText={(value) => {
            setKcalText(value);
            if (error) setError(null);
          }}
          onSubmitEditing={handleSubmit}
          placeholder="e.g. 250"
          placeholderTextColor={tokens.textMuted}
          returnKeyType="done"
          style={{
            borderColor: tokens.border,
            backgroundColor: tokens.surfaceSunken,
            color: tokens.text,
          }}
          value={kcalText}
        />
        <Button
          label="Add"
          accessibilityLabel="Add quick-calorie entry"
          size="sm"
          color={accentColor}
          loading={saving}
          onPress={handleSubmit}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger" className="mt-1" accessibilityLabel="Quick add error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
