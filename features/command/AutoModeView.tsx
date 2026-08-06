import { useState } from 'react';

import { Text, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { TextField } from '@/core/ui/TextField';
import { useAppTheme } from '@/core/providers/ThemeProvider';
import { toDateKey } from '@/lib/time';
import { askParser } from './askParser';
import type { AskResult } from './ask.types';
import { classifyForAutoMode } from './autoModeRouter';
import type { CommandMode } from './commandModePreference';
import { getParserContext, getTomorrowDateKey } from './commandScreenUtils';

export function AutoModeView({
  placeholder,
  onSwitchToMode,
}: {
  placeholder: string;
  onSwitchToMode: (mode: CommandMode) => void;
}) {
  const { tokens } = useAppTheme();
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);
  const [routedTo, setRoutedTo] = useState<'ask' | 'create' | null>(null);

  const hasQuestionText = question.trim().length > 0;

  const handleAutoSubmit = async () => {
    if (!hasQuestionText || isLoading) return;
    setIsLoading(true);
    setLastResult(null);
    setRoutedTo(null);

    const now = new Date();
    const parserContext = getParserContext();

    try {
      const { route } = await classifyForAutoMode({
        question,
        conversationContext: [],
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });

      if (route.route === 'ask') {
        setRoutedTo('ask');
        const result = await askParser.ask({
          question,
          conversationContext: [],
          now,
          locale: parserContext.locale,
          timeZone: parserContext.timeZone,
          todayDateKey: toDateKey(now),
          tomorrowDateKey: getTomorrowDateKey(now),
        });
        setLastResult(result);
      } else {
        setRoutedTo('create');
        // For Create route, delegate to the command parser.
        // The auto-mode view surfaces the route decision; the user is directed
        // to the Create tab to submit the same text there via the "switch to
        // Create" affordance.
      }
    } catch (error) {
      setLastResult({
        outcome: 'unavailable',
        question,
        message: error instanceof Error ? error.message : 'Auto mode classification failed.',
        reasonCode: 'request_failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="gap-4">
      <TextField
        label=""
        placeholder={placeholder}
        value={question}
        onChangeText={setQuestion}
        accessibilityLabel="Auto mode question"
      />
      <Button
        label={isLoading ? 'Sending…' : 'Send'}
        onPress={handleAutoSubmit}
        disabled={!hasQuestionText || isLoading}
      />

      {lastResult ? (
        <Card
          variant="header"
          accentColor={
            lastResult.outcome === 'answer'
              ? tokens.primary
              : lastResult.outcome === 'unsupported'
                ? tokens.textMuted
                : tokens.dangerText
          }
          headerTitle={
            lastResult.outcome === 'answer'
              ? 'Auto → Ask'
              : lastResult.outcome === 'unsupported'
                ? 'Unsupported'
                : 'Unavailable'
          }
          headerSubtitle={
            lastResult.outcome === 'answer'
              ? lastResult.answer
              : lastResult.outcome === 'unsupported'
                ? lastResult.reason
                : lastResult.message
          }
          className="mb-0"
        >
          {routedTo === 'create' && (
            <View className="gap-3">
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                Auto routed this to Create. Switch to the Create tab and try again.
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button
                    label="Switch to Create"
                    onPress={() => onSwitchToMode('create')}
                    color={tokens.textMuted}
                  />
                </View>
              </View>
            </View>
          )}
        </Card>
      ) : null}
    </View>
  );
}
