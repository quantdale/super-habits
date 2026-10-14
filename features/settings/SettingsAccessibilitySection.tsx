import { Text } from '@/core/ui/Text';
import { useState } from 'react';
import { View } from 'react-native';
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
import { REWARD_COLORS } from '@/constants/sectionColors';
import {
  emitRewardFeedback,
  setRewardFeedbackPreferences,
  useRewardFeedbackPreferences,
} from '@/lib/rewardFeedback';
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
  const rewardFeedback = useRewardFeedbackPreferences();
  const effectiveMotion =
    preference === 'system' ? (reducedMotionActive ? 'reduced' : 'full') : preference;

  return (
    <>
      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Accessibility"
          title="Motion"
          accentColor={tokens.textMuted}
        />
        <Card accentColor={tokens.textMuted} className="mb-0">
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Reduce motion
              </Text>
              <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
                Reduced motion swaps large animations for instant state changes.
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

            {/* W13 (SUR-08): one row states the effective motion; the old
                `Current selection` + `Active behavior` pair narrated the same
                preference twice. Nothing in the app depends on animations
                playing, so the guarantee moves into Details. */}
            <SettingsRow
              first
              label="Effective motion"
              value={
                effectiveMotion === 'reduced'
                  ? 'Animations are minimized right now; state changes stay instant.'
                  : 'Animations play at full motion right now.'
              }
              explanation={`Nothing in the app depends on animations playing. ${MOTION_DESCRIPTIONS[preference]}`}
              statusLabel={effectiveMotion}
              accentColor={tokens.textMuted}
              last
            />
          </View>
        </Card>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Accessibility"
          title="Reward feedback"
          accentColor={REWARD_COLORS.accent}
        />
        <Card accentColor={REWARD_COLORS.accent} className="mb-0">
          <View className="gap-4">
            <View>
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                Feedback intensity
              </Text>
              <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
                A routine check-off gets a light tap. Completing a daily quest, a streak milestone,
                a complete day, a badge, or a level gets the stronger pattern plus a short tone.
              </Text>
            </View>

            <View className="flex-row flex-wrap">
              <PillChip
                label="Haptics on"
                active={rewardFeedback.haptics}
                color={REWARD_COLORS.accent}
                onPress={() => {
                  setRewardFeedbackPreferences({ haptics: true });
                  emitRewardFeedback('light');
                }}
              />
              <PillChip
                label="Haptics off"
                active={!rewardFeedback.haptics}
                color={REWARD_COLORS.accent}
                onPress={() => setRewardFeedbackPreferences({ haptics: false })}
              />
              <PillChip
                label="Sounds on"
                active={rewardFeedback.sound}
                color={REWARD_COLORS.accent}
                onPress={() => {
                  setRewardFeedbackPreferences({ sound: true });
                  emitRewardFeedback('success');
                }}
              />
              <PillChip
                label="Sounds off"
                active={!rewardFeedback.sound}
                color={REWARD_COLORS.accent}
                onPress={() => setRewardFeedbackPreferences({ sound: false })}
              />
            </View>

            {/* W13 (SUR-08): the pills already carry the values; these two rows
                state each one once, with the behavioural detail in Details. */}
            <SettingsRow
              first
              label="Haptics"
              value={
                rewardFeedback.haptics
                  ? 'Vibration feedback is on for completions and milestones.'
                  : 'Vibration feedback is off. Rewards are visual only.'
              }
              explanation="A routine check-off gets a light tap; milestones get the stronger pattern."
              statusLabel={rewardFeedback.haptics ? 'on' : 'off'}
              statusTone={rewardFeedback.haptics ? 'accent' : 'neutral'}
              accentColor={REWARD_COLORS.accent}
            />
            <SettingsRow
              last
              label="Reward sounds"
              value={
                rewardFeedback.sound
                  ? 'Quest and level rewards play a short tone.'
                  : 'All reward sounds are off.'
              }
              explanation="Check-offs stay silent; only quest, streak, day, badge and level rewards play a tone."
              statusLabel={rewardFeedback.sound ? 'on' : 'off'}
              statusTone={rewardFeedback.sound ? 'accent' : 'neutral'}
              accentColor={REWARD_COLORS.accent}
            />
          </View>
        </Card>
      </ScreenSection>
    </>
  );
}
