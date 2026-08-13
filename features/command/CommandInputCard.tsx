import { Text, View } from 'react-native';
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
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  examples: string[];
  isParsing: boolean;
  parseDisabled: boolean;
  onParse: () => void;
}) {
  const { tokens } = useAppTheme();

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
