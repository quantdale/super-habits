import { useState } from 'react';

import { Text, View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { TextField } from '@/core/ui/TextField';
import { useAppTheme } from '@/core/providers/themeContext';
import { toDateKey } from '@/lib/time';
import { askParser } from './askParser';
import { useAskConversation } from './askConversationContextValue';
import type { AskResult } from './ask.types';
import { CommandSection } from './CommandSection';
import { getParserContext, getTomorrowDateKey } from './commandScreenUtils';

export function AskConversationView({ placeholder }: { placeholder: string }) {
  const { tokens } = useAppTheme();
  const { turns, addTurn } = useAskConversation();
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);

  const hasQuestionText = question.trim().length > 0;

  const handleAsk = async () => {
    setIsAsking(true);
    setLastResult(null);
    const now = new Date();
    const parserContext = getParserContext();

    try {
      const result = await askParser.ask({
        question,
        conversationContext: turns,
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });

      setLastResult(result);
      if (result.outcome === 'answer') {
        addTurn({ question: result.question, answer: result.answer });
        setQuestion('');
      }
    } catch (error) {
      // Retrieval-layer failures (e.g. a SQLite error) are rethrown by
      // askParser.ask; surface them as a retryable unavailable result rather
      // than leaving the button stuck on "Asking…".
      setLastResult({
        outcome: 'unavailable',
        question,
        message: error instanceof Error ? error.message : 'Ask failed unexpectedly.',
        reasonCode: 'request_failed',
      });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <View className="gap-4">
      {turns.length > 0 ? (
        <CommandSection>
          <Card
            variant="header"
            accentColor={tokens.textMuted}
            headerTitle="Conversation"
            headerSubtitle="Cleared only when the app restarts."
            className="mb-0"
          >
            <View className="gap-3">
              {turns.map((turn, index) => (
                <View key={`${index}:${turn.question}`} className="gap-1">
                  <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                    {turn.question}
                  </Text>
                  <Text className="text-sm" style={{ color: tokens.textMuted }}>
                    {turn.answer}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </CommandSection>
      ) : null}

      <CommandSection>
        <Card
          variant="header"
          accentColor={tokens.textMuted}
          headerTitle="Ask a question"
          headerSubtitle="Answers come only from your own local data. Nothing is saved."
          className="mb-0"
        >
          <View className="gap-3">
            <TextField
              label="Question"
              value={question}
              onChangeText={(value) => {
                setQuestion(value);
                setLastResult(null);
              }}
              placeholder={placeholder}
              nativeID="ask-input"
            />
            <Button
              label={isAsking ? 'Asking...' : 'Ask'}
              onPress={handleAsk}
              color={tokens.textMuted}
              disabled={!hasQuestionText || isAsking}
            />
          </View>
        </Card>
      </CommandSection>

      {lastResult?.outcome === 'unsupported' ? (
        <CommandSection className="mb-0">
          <Card
            variant="header"
            accentColor={tokens.textMuted}
            headerTitle="Out of scope for this version"
            headerSubtitle="Nothing was saved or changed."
            className="mb-0"
          >
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              {lastResult.reason}
            </Text>
          </Card>
        </CommandSection>
      ) : null}

      {lastResult?.outcome === 'unavailable' ? (
        <CommandSection className="mb-0">
          <Card
            variant="header"
            accentColor={tokens.textMuted}
            headerTitle="Ask is temporarily unavailable"
            headerSubtitle="Nothing was saved or changed."
            className="mb-0"
          >
            <View className="gap-3">
              <Text className="text-sm" style={{ color: tokens.textMuted }}>
                {lastResult.message}
              </Text>
              <Button
                label="Try again"
                onPress={handleAsk}
                color={tokens.textMuted}
                disabled={!hasQuestionText || isAsking}
              />
            </View>
          </Card>
        </CommandSection>
      ) : null}
    </View>
  );
}
