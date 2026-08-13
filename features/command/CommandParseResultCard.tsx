import { Text, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { useAppTheme } from '@/core/providers/themeContext';
import { CommandSection } from './CommandSection';

export function CommandParseResultCard({
  outcome,
  message,
  onRetry,
  retryDisabled,
}: {
  outcome: 'unsupported' | 'unavailable';
  message: string;
  onRetry: () => void;
  retryDisabled: boolean;
}) {
  const { tokens } = useAppTheme();

  return (
    <CommandSection className="mb-0">
      <Card
        variant="header"
        accentColor={tokens.textMuted}
        headerTitle={outcome === 'unsupported' ? 'Try rewording your command' : 'Parse unavailable'}
        headerSubtitle="Nothing has been saved yet."
        className="mb-0"
      >
        {outcome === 'unsupported' ? (
          <Text className="text-sm" style={{ color: tokens.textMuted }}>
            {message}
          </Text>
        ) : (
          <View className="gap-3">
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              {message}
            </Text>
            <Button
              label="Try again"
              onPress={onRetry}
              color={tokens.textMuted}
              disabled={retryDisabled}
            />
          </View>
        )}
      </Card>
    </CommandSection>
  );
}
