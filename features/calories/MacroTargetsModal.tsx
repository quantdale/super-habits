import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { Button } from '@/core/ui/Button';
import { Modal } from '@/core/ui/Modal';
import { TextField } from '@/core/ui/TextField';
import type { MacroTargets } from './calories.domain';

type Props = {
  visible: boolean;
  currentTargets: MacroTargets;
  onSave: (targets: MacroTargets) => void;
  onClose: () => void;
};

const FIELDS: readonly { key: keyof MacroTargets; label: string; unit: string }[] = [
  { key: 'calories', label: 'Daily calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
];

/** Editable daily macro targets. Informational planning aid only. */
export function MacroTargetsModal({ visible, currentTargets, onSave, onClose }: Props) {
  const { tokens } = useAppTheme();
  const [values, setValues] = useState<Record<keyof MacroTargets, string>>({
    calories: String(currentTargets.calories),
    protein: String(currentTargets.protein),
    carbs: String(currentTargets.carbs),
    fats: String(currentTargets.fats),
  });
  const [error, setError] = useState<string | null>(null);

  // Reset the draft when the modal opens, without an effect:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValues({
        calories: String(currentTargets.calories),
        protein: String(currentTargets.protein),
        carbs: String(currentTargets.carbs),
        fats: String(currentTargets.fats),
      });
      setError(null);
    }
  }

  const handleSave = () => {
    const parsed = FIELDS.map(({ key }) => ({ key, value: Number(values[key]) }));
    if (parsed.some(({ value }) => !Number.isFinite(value) || value < 0)) {
      setError('Enter non-negative numbers for every field.');
      return;
    }
    if (parsed[0].value < 500 || parsed[0].value > 6000) {
      setError('Daily calories must be between 500 and 6000.');
      return;
    }
    if (parsed.slice(1).some(({ value }) => value > 999)) {
      setError('Macro grams must be 999 or less.');
      return;
    }
    onSave({
      calories: Math.round(parsed[0].value),
      protein: Math.round(parsed[1].value),
      carbs: Math.round(parsed[2].value),
      fats: Math.round(parsed[3].value),
    });
    onClose();
  };

  return (
    <Modal title="Daily targets" visible={visible} onClose={onClose}>
      <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
        Optional per-day targets for calories and macros. Informational only.
      </Text>
      <View className="gap-3">
        {FIELDS.map(({ key, label, unit }) => (
          <TextField
            key={key}
            label={`${label} (${unit})`}
            value={values[key]}
            onChangeText={(text) => {
              setError(null);
              setValues((current) => ({ ...current, [key]: text }));
            }}
            unsignedInteger
          />
        ))}
      </View>
      {error ? (
        <Text className="mt-2 text-xs" style={{ color: tokens.dangerText }}>
          {error}
        </Text>
      ) : null}
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1">
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </View>
        <View className="flex-1">
          <Button label="Save targets" onPress={handleSave} />
        </View>
      </View>
    </Modal>
  );
}
