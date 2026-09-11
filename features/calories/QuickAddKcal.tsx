import { Text } from '@/core/ui/Text';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { PillChip } from '@/core/ui/PillChip';

/** Same upper bound as the macro-form kcal validation (lib/validation.ts). */
const MAX_QUICK_ADD_KCAL = 9999;

/** One-tap kcal presets rendered as chunky chips above the manual input. */
const QUICK_ADD_PRESETS = [100, 200, 300, 500] as const;

/**
 * Compact kcal-only logger shown next to the recent/frequent chips.
 * calorie_entries stores an explicit calories column, so a zero-macro entry
 * needs no fabricated macros and no migration; `onSubmit` writes through the
 * existing create path (same sync/backup intents as the full form).
 */
export function QuickAddKcal({
  onSubmit,
  accentColor,
}: {
  onSubmit: (kcal: number) => Promise<void>;
  accentColor: string;
}) {
  const { tokens } = useAppTheme();
  const [kcalText, setKcalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveKcal = (kcal: number) => {
    if (saving) return;
    setError(null);
    setSaving(true);
    void (async () => {
      try {
        await onSubmit(kcal);
        setKcalText('');
      } catch {
        setError('Could not save entry.');
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleSubmit = () => {
    if (saving) return;
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
      <Text variant="label" tone="muted" className="mb-1.5" style={{ textTransform: 'uppercase' }}>
        Quick add calories
      </Text>
      <View className="mb-2 flex-row flex-wrap">
        {QUICK_ADD_PRESETS.map((preset) => (
          <PillChip
            key={preset}
            label={`${preset}`}
            accessibilityLabel={`Quick add ${preset} kilocalories`}
            active={false}
            color={accentColor}
            onPress={() => saveKcal(preset)}
          />
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
