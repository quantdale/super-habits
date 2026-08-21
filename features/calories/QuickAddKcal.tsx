import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';

/** Same upper bound as the macro-form kcal validation (lib/validation.ts). */
const MAX_QUICK_ADD_KCAL = 9999;

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
    setError(null);
    setSaving(true);
    void (async () => {
      try {
        await onSubmit(parsed);
        setKcalText('');
      } catch {
        setError('Could not save entry.');
      } finally {
        setSaving(false);
      }
    })();
  };

  return (
    <View className="mb-3">
      <Text
        className="mb-1.5 text-xs font-semibold uppercase tracking-[0.8px]"
        style={{ color: tokens.textMuted }}
      >
        Quick add calories
      </Text>
      <View className="flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="Quick add calories"
          className="min-h-[44px] flex-1 rounded-2xl border px-4 text-sm"
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
            backgroundColor: tokens.surfaceElevated,
            color: tokens.text,
          }}
          value={kcalText}
        />
        <Pressable
          accessibilityLabel="Add quick-calorie entry"
          accessibilityRole="button"
          disabled={saving}
          onPress={handleSubmit}
          className="h-11 min-h-[44px] flex-row items-center justify-center gap-1 rounded-2xl px-4"
          style={{ backgroundColor: accentColor, opacity: saving ? 0.4 : 1 }}
        >
          <MaterialIcons name="add" size={18} color={tokens.textOnAccent} />
          <Text className="text-sm font-semibold" style={{ color: tokens.textOnAccent }}>
            Add
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text
          className="mt-1 text-xs"
          style={{ color: tokens.dangerText }}
          accessibilityLabel="Quick add error"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
