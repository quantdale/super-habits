import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  getMotionPreference,
  setMotionPreference,
  useReducedMotion,
  type MotionPreference,
} from '@/core/theme/motion';
import { useAppTheme } from '@/core/providers/themeContext';
import { Card } from '@/core/ui/Card';
import { PillChip } from '@/core/ui/PillChip';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

const MOTION_OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'full', label: 'Full' },
];

const MOTION_DESCRIPTIONS: Record<MotionPreference, string> = {
  system: 'Follow your device Reduce Motion setting automatically.',
  reduced: 'Minimize animation everywhere in SuperHabits.',
  full: 'Allow all motion and transitions.',
};

/**
 * Settings → Accessibility. Persists exclusively through
 * `setMotionPreference` (it writes AsyncStorage itself); the modal remounts
 * this section on every open, so the initial read sees the hydrated value.
 */
export function SettingsAccessibilitySection() {
  const { tokens } = useAppTheme();
  const [preference, setPreferenceState] = useState<MotionPreference>(() => getMotionPreference());
  const reducedMotionActive = useReducedMotion();
  const effectiveMotion =
    preference === 'system' ? (reducedMotionActive ? 'reduced' : 'full') : preference;

  return (
    <ScreenSection>
      <SettingsSectionHeading
        eyebrow="Accessibility"
        title="Motion"
        subtitle="Control how much animation SuperHabits uses."
        icon="accessibility"
        accentColor={tokens.textMuted}
      />
      <Card accentColor={tokens.textMuted} className="mb-0">
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Reduce motion
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Reduced motion swaps large animations for instant state changes. Nothing in the app
              depends on animations playing.
            </Text>
          </View>

          <View className="flex-row flex-wrap">
            {MOTION_OPTIONS.map((option) => (
              <PillChip
                key={option.value}
                label={option.label}
                active={preference === option.value}
                color={tokens.textMuted}
                onPress={() => {
                  setMotionPreference(option.value);
                  setPreferenceState(option.value);
                }}
              />
            ))}
          </View>

          <SettingsRow
            first
            label="Current selection"
            description={MOTION_DESCRIPTIONS[preference]}
            statusLabel={preference}
            statusTone="accent"
            accentColor={tokens.textMuted}
          />
          <SettingsRow
            last
            label="Active behavior"
            description={
              effectiveMotion === 'reduced'
                ? 'Animations are minimized right now; state changes stay instant.'
                : 'Animations play at full motion right now.'
            }
            statusLabel={effectiveMotion}
          />
        </View>
      </Card>
    </ScreenSection>
  );
}
