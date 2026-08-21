import { Text, View, Pressable } from 'react-native';

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
    <Card
      variant="header"
      accentColor={tokens.textMuted}
      headerTitle="Command input"
      headerSubtitle="Experimental draft parsing only. Nothing is saved until you confirm."
      className="mb-0"
    >
      <View className="gap-3">
        <TextField
          label="Command"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          nativeID="command-input"
        />

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

        {suggestionChips.length > 0 ? (
          <View>
            <Text className="mb-1 text-sm font-semibold" style={{ color: tokens.text }}>
              Suggestions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {suggestionChips.map((entry) => (
                <Pressable
                  key={`suggestion-${entry}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Use suggested command: ${entry}`}
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

        <View
          className="rounded-xl border px-3 py-3"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Supported examples
          </Text>
          {examples.map((example) => (
            <Text key={example} className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
              {example}
            </Text>
          ))}
        </View>

        <Button
          label={isParsing ? 'Parsing...' : 'Parse command'}
          onPress={onParse}
          color={tokens.textMuted}
          disabled={parseDisabled}
        />
      </View>
    </Card>
  );
}

const COMMAND_CHIP_LIMIT = 4;
