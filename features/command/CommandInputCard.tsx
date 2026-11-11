import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { TextField } from '@/core/ui/TextField';
import { Text } from '@/core/ui/Text';
import { useKeyboardFocusRing } from '@/core/ui/useKeyboardFocusRing';
import { useAppTheme } from '@/core/providers/themeContext';
import { radius, spacing } from '@/core/theme/designTokens';
import { CommandPrompt } from './CommandPrompt';
import { commandRunButtonVisual } from './commandInput.visual';

export function CommandInputCard({
  value,
  onChangeText,
  placeholder,
  examples,
  isParsing,
  parseDisabled,
  onParse,
  history = [],
  onPickHistoryText,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  examples: string[];
  isParsing: boolean;
  parseDisabled: boolean;
  onParse: () => void;
  /** Recent invocations, most recent first. */
  history?: string[];
  onPickHistoryText?: (text: string) => void;
}) {
  const { tokens, resolvedTheme } = useAppTheme();
  const isInputEmpty = value.trim().length === 0;
  const suggestionChips = isInputEmpty ? history.slice(0, 4) : [];
  const examplesToShow = [...new Set([...examples, ...suggestionChips])].slice(
    0,
    COMMAND_CHIP_LIMIT,
  );
  // §5.1 tier: light paints Sprout `solid` under a white label, dark paints
  // Sprout `bright` under the ink label. `Button` keeps the AA floor on the face.
  const runVisual = commandRunButtonVisual({ appearance: resolvedTheme });

  return (
    <Card innerClassName="p-3" className="mb-0">
      <View style={{ gap: spacing.md }}>
        {/* P19 (§7 Command Center, ref Brilliant `08`): Sprout in the `think`
            pose with one speech bubble says what the field is for, above the
            input. Decorative mascot + plain static copy, so no accessible name
            changes; it is the screen's single mascot appearance (§4 rule 7). */}
        <CommandPrompt message="Tell me what to add" />

        {/* Input first: the field leads the surface, above every example. */}
        <TextField
          label="Command"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          nativeID="command-input"
        />

        {/* W13 (design D13.3, SYS-14): one caption replaces the two-sentence
            implementation narration; the header title is gone entirely. */}
        <Text variant="caption" tone="muted">
          Parsing saves text in recent commands on this device. App actions require confirmation.
        </Text>

        <Button
          label={isParsing ? 'Parsing...' : 'Parse command'}
          icon="edit"
          onPress={onParse}
          color={runVisual.face}
          disabled={parseDisabled}
          fullWidth
        />

        {/* Examples and history are discovery aids, so they render only while
            the field is empty — a typed command must not sit under a wall of
            example text (W13-06). */}
        {isInputEmpty && examplesToShow.length > 0 ? (
          <View>
            <Text variant="label" style={{ color: tokens.text }}>
              Try
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {examplesToShow.map((entry) => (
                <ChipButton
                  key={`try-${entry}`}
                  label={entry}
                  accessibilityLabel={`Use example: ${entry}`}
                  onPress={() => onChangeText(entry)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {history.length > 0 ? (
          <View>
            <Text variant="label" style={{ color: tokens.text }}>
              Recent commands
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {history.slice(0, COMMAND_CHIP_LIMIT).map((entry) => (
                <ChipButton
                  key={entry}
                  label={entry}
                  accessibilityLabel={`Reuse recent command: ${entry}`}
                  onPress={() => onPickHistoryText?.(entry)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * A quiet suggestion pill. Plain `Pressable` (not `Chip`) because these are
 * one-shot actions, not toggles: the accessible name is the explicit
 * "Use example:"/"Reuse recent command:" sentence every spec selects by, and
 * the visible label stays the command text.
 */
function ChipButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <PressableWithRing
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      borderColor={tokens.border}
      backgroundColor={tokens.chipBackground}
      tokens={tokens}
    >
      <Text variant="label" numberOfLines={1} style={{ color: tokens.textMuted }}>
        {label}
      </Text>
    </PressableWithRing>
  );
}

const COMMAND_CHIP_LIMIT = 4;

/** Minimal pressable pill with the repo's 44pt contract and focus ring. */
function PressableWithRing({
  accessibilityLabel,
  onPress,
  borderColor,
  backgroundColor,
  tokens,
  children,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  borderColor: string;
  backgroundColor: string;
  tokens: ReturnType<typeof useAppTheme>['tokens'];
  children: ReactNode;
}) {
  const focusRing = useKeyboardFocusRing(tokens.accent);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={focusRing.onFocus}
      onBlur={focusRing.onBlur}
      hitSlop={{ top: 4, bottom: 4 }}
      style={[
        {
          // The repo's 44pt contract has to live on the FACE here: this is a
          // plain `Pressable`, and react-native-web never applies `hitSlop` to
          // the DOM box (docs/testing/known-gaps.md CG-12), so a 40pt face was
          // a 40px web hit area for a pointer user.
          minHeight: 44,
          maxWidth: '100%',
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor,
          backgroundColor,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.xs + 2,
          justifyContent: 'center',
        },
        focusRing.focusRingStyle,
      ]}
    >
      {children}
    </Pressable>
  );
}
