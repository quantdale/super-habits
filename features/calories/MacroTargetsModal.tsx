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

/**
 * Only protein/carbs/fats are editable here: these targets drive the three
 * macro bars, while daily calories stay owned by the goal modal (the
 * `calories` value is carried through unchanged).
 */
const FIELDS: readonly { key: 'protein' | 'carbs' | 'fats'; label: string; unit: string }[] = [
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
];

/** Editable daily macro targets. Informational planning aid only. */
export function MacroTargetsModal({ visible, currentTargets, onSave, onClose }: Props) {
  const { tokens } = useAppTheme();
  const [values, setValues] = useState<Record<'protein' | 'carbs' | 'fats', string>>({
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
    if (parsed.some(({ value }) => value > 999)) {
      setError('Macro grams must be 999 or less.');
      return;
    }
    onSave({
      calories: currentTargets.calories,
      protein: Math.round(parsed[0].value),
      carbs: Math.round(parsed[1].value),
      fats: Math.round(parsed[2].value),
    });
    onClose();
  };

  return (
    <Modal title="Daily targets" visible={visible} onClose={onClose}>
      <Text className="mb-3 text-xs" style={{ color: tokens.textMuted }}>
        Optional per-day protein/carb/fat targets for the macro bars. Informational only.
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
