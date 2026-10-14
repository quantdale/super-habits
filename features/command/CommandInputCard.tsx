import { Text } from '@/core/ui/Text';
import { Pressable, View } from 'react-native';

import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { TextField } from '@/core/ui/TextField';
import { useAppTheme } from '@/core/providers/themeContext';

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
  const { tokens } = useAppTheme();
  const isInputEmpty = value.trim().length === 0;
  const suggestionChips = isInputEmpty ? history.slice(0, 4) : [];

  return (
    <Card innerClassName="p-3" className="mb-0">
      <View className="gap-3">
        <TextField
          label="Command"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          nativeID="command-input"
        />

        {/* W13 (design D13.3, SYS-14): one caption replaces the two-sentence
            implementation narration; the header title is gone entirely. */}
        <Text className="text-xs" style={{ color: tokens.textMuted }}>
          Parsing saves text in recent commands on this device. App actions require confirmation.
        </Text>

        <Button
          label={isParsing ? 'Parsing...' : 'Parse command'}
          onPress={onParse}
          color={tokens.textMuted}
          disabled={parseDisabled}
        />

        {/* Examples and history are discovery aids, so they render only while
            the field is empty — a typed command must not sit under a wall of
            example text (W13-06). */}
        {isInputEmpty && (examples.length > 0 || suggestionChips.length > 0) ? (
          <View>
            <Text className="mb-1 text-sm font-semibold" style={{ color: tokens.text }}>
              Try
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[...new Set([...examples, ...suggestionChips])]
                .slice(0, COMMAND_CHIP_LIMIT)
                .map((entry) => (
                  <Pressable
                    key={`try-${entry}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Use example: ${entry}`}
                    className="rounded-full border px-3 py-1.5"
                    style={{ borderColor: tokens.border, backgroundColor: tokens.surface }}
                    onPress={() => onChangeText(entry)}
                  >
                    <Text numberOfLines={1} className="text-xs" style={{ color: tokens.textMuted }}>
                      {entry}
                    </Text>
                  </Pressable>
                ))}
            </View>
          </View>
        ) : null}

        {history.length > 0 ? (
          <View>
            <Text className="mb-1 text-sm font-semibold" style={{ color: tokens.text }}>
              Recent commands
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {history.slice(0, COMMAND_CHIP_LIMIT).map((entry) => (
                <Pressable
                  key={entry}
                  accessibilityRole="button"
                  accessibilityLabel={`Reuse recent command: ${entry}`}
                  className="rounded-full border px-3 py-1.5"
                  style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
                  onPress={() => onPickHistoryText?.(entry)}
                >
                  <Text numberOfLines={1} className="text-xs" style={{ color: tokens.text }}>
                    {entry}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const COMMAND_CHIP_LIMIT = 4;
