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
import { PillChip } from '@/core/ui/PillChip';
import { ScreenSection } from '@/core/ui/ScreenSection';
import { Switch } from '@/core/ui/Switch';
import { spacing } from '@/core/theme/designTokens';
import { REWARD_COLORS } from '@/constants/sectionColors';
import {
  emitRewardFeedback,
  setRewardFeedbackPreferences,
  useRewardFeedbackPreferences,
} from '@/lib/rewardFeedback';
import { SettingsGroup, SettingsRow, SettingsSectionHeading } from './SettingsSharedUi';

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
 * Settings → Accessibility (Playful Momentum §7: bold group titles, rows in
 * `depth.flat` groups, chunky Sprout switches, no narration paragraphs).
 *
 * Motion persists exclusively through `setMotionPreference` (it writes
 * AsyncStorage itself); the modal remounts this section on every open, so the
 * initial read sees the hydrated value.
 *
 * Reward feedback is the pair the brief calls out: the two preferences are
 * real two-position switches on a Sprout-bright track with a white knob and
 * lip. Their position labels are the *existing* strings (`Haptics on` /
 * `Haptics off`, `Sounds on` / `Sounds off`) because those words are the
 * preference contract several specs address, and the behaviour is unchanged:
 * choosing "on" emits the same preview feedback the pills emitted.
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
        <SettingsGroup>
          <View style={{ paddingBottom: spacing.md }}>
            <Text variant="bodyMd" className="font-bold">
              Reduce motion
            </Text>
            <View className="mt-2 flex-row flex-wrap">
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
          </View>

          {/* SUR-08: one row states the effective motion; the old
              `Current selection` + `Active behavior` pair narrated the same
              preference twice. Nothing in the app depends on animations
              playing, so the guarantee sits in Details. */}
          <SettingsRow
            label="Effective motion"
            value={
              effectiveMotion === 'reduced'
                ? 'Animations are minimized right now; state changes stay instant.'
                : 'Animations play at full motion right now.'
            }
            explanation={`Motion setting: ${MOTION_DESCRIPTIONS[preference]} Nothing in the app depends on animations playing.`}
            statusLabel={effectiveMotion}
            accentColor={tokens.textMuted}
            last
          />
        </SettingsGroup>
      </ScreenSection>

      <ScreenSection>
        <SettingsSectionHeading
          eyebrow="Accessibility"
          title="Reward feedback"
          accentColor={REWARD_COLORS.accent}
        />
        <SettingsGroup accentColor={REWARD_COLORS.accent}>
          <SettingsRow
            label="Haptics"
            value={
              rewardFeedback.haptics
                ? 'Vibration feedback is on for completions and milestones.'
                : 'Vibration feedback is off. Rewards are visual only.'
            }
            explanation="A routine check-off gets a light tap; quests, streak milestones, a complete day, a badge or a level get the stronger pattern."
            statusLabel={rewardFeedback.haptics ? 'on' : 'off'}
            statusTone={rewardFeedback.haptics ? 'accent' : 'neutral'}
            accentColor={REWARD_COLORS.accent}
          />
          <View style={{ paddingVertical: spacing.sm }}>
            <Switch
              accessibilityLabel="Haptics"
              options={[
                { value: 'on', label: 'Haptics on' },
                { value: 'off', label: 'Haptics off' },
              ]}
              value={rewardFeedback.haptics ? 'on' : 'off'}
              onChange={(next) => {
                const enabled = next === 'on';
                setRewardFeedbackPreferences({ haptics: enabled });
                if (enabled) emitRewardFeedback('light');
              }}
            />
          </View>

          <SettingsRow
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
          <View style={{ paddingTop: spacing.sm }}>
            <Switch
              accessibilityLabel="Reward sounds"
              options={[
                { value: 'on', label: 'Sounds on' },
                { value: 'off', label: 'Sounds off' },
              ]}
              value={rewardFeedback.sound ? 'on' : 'off'}
              onChange={(next) => {
                const enabled = next === 'on';
                setRewardFeedbackPreferences({ sound: enabled });
                if (enabled) emitRewardFeedback('success');
              }}
            />
          </View>
        </SettingsGroup>
      </ScreenSection>
    </>
  );
}
