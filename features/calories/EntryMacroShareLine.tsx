import { Text } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { macroKcalShares } from './calories.domain';

/**
 * Informational macro energy-share line for an entry, e.g.
 * "Energy share: P 40% · C 35% · F 20% · Fi 5%". No health guidance implied.
 */
export function EntryMacroShareLine({
  protein,
  carbs,
  fats,
  fiber,
}: {
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
}) {
  const { tokens } = useAppTheme();
  const shares = macroKcalShares(protein, carbs, fats, fiber);
  if (shares.protein + shares.carbs + shares.fats + shares.fiber === 0) return null;

  return (
    <Text className="mt-1 text-xs" style={{ color: tokens.textMuted }}>
      Energy share: P {shares.protein}% · C {shares.carbs}% · F {shares.fats}%
      {fiber > 0 ? ` · Fi ${shares.fiber}%` : ''}
    </Text>
  );
}
