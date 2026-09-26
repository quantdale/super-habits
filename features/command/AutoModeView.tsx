import { Text } from '@/core/ui/Text';
import { useState } from 'react';

import { View } from 'react-native';
import { Button } from '@/core/ui/Button';
import { Card } from '@/core/ui/Card';
import { TextField } from '@/core/ui/TextField';
import { useAppTheme } from '@/core/providers/themeContext';
import { toDateKey } from '@/lib/time';
import { askParser } from './askParser';
import type { AskResult } from './ask.types';
import { classifyForAutoMode } from './autoModeRouter';
import type { CommandMode } from './commandModePreference';
import { getParserContext, getTomorrowDateKey } from './commandScreenUtils';
import type { ParseCommandResult } from './types';

export function AutoModeView({
  placeholder,
  onSwitchToMode,
  onRouteToCreate,
  onInputChange,
}: {
  placeholder: string;
  onSwitchToMode: (mode: CommandMode, draftText?: string) => void;
  onRouteToCreate: (submittedText: string) => Promise<ParseCommandResult | null>;
  onInputChange: () => void;
}) {
  const { tokens } = useAppTheme();
  const [question, setQuestion] = useState('');
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AskResult | null>(null);
  const [createResult, setCreateResult] = useState<ParseCommandResult | null>(null);
  const [routedTo, setRoutedTo] = useState<'ask' | 'create' | null>(null);
  const [createRouteReason, setCreateRouteReason] = useState<string | null>(null);

  const hasQuestionText = question.trim().length > 0;

  const handleQuestionChange = (value: string) => {
    setQuestion(value);
    setSubmittedText(null);
    setLastResult(null);
    setCreateResult(null);
    setRoutedTo(null);
    setCreateRouteReason(null);
    onInputChange();
  };

  const routeToCreate = async (input: string, reason: string) => {
    setIsLoading(true);
    setLastResult(null);
    setCreateResult(null);
    setRoutedTo(null);
    try {
      const result = await onRouteToCreate(input);
      setCreateResult(
        result ?? {
          outcome: 'unavailable',
          rawText: input,
          message: 'The Create draft could not be prepared. No app action ran.',
          reasonCode: 'request_failed',
        },
      );
      setCreateRouteReason(reason);
      setRoutedTo('create');
    } catch {
      setCreateResult({
        outcome: 'unavailable',
        rawText: input,
        message: 'The Create draft could not be prepared. No app action ran.',
        reasonCode: 'request_failed',
      });
      setCreateRouteReason(reason);
      setRoutedTo('create');
    } finally {
      setIsLoading(false);
    }
  };

  const retryAsAsk = async () => {
    if (submittedText === null || isLoading) return;
    const input = submittedText;
    setIsLoading(true);
    setCreateResult(null);
    setRoutedTo(null);
    onInputChange();
    const now = new Date();
    const parserContext = getParserContext();
    try {
      const result = await askParser.ask({
        question: input,
        conversationContext: [],
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });
      setLastResult(result);
    } catch {
      setLastResult({
        outcome: 'unavailable',
        question: input,
        message: 'Ask is temporarily unavailable. No app entries changed.',
        reasonCode: 'request_failed',
      });
    } finally {
      setRoutedTo('ask');
      setIsLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
    if (!hasQuestionText || isLoading) return;
    const input = question;
    setSubmittedText(input);
    setIsLoading(true);
    setLastResult(null);
    setCreateResult(null);
    setRoutedTo(null);
    setCreateRouteReason(null);
    onInputChange();

    const now = new Date();
    const parserContext = getParserContext();

    try {
      const { route, classification } = await classifyForAutoMode({
        question: input,
        conversationContext: [],
        now,
        locale: parserContext.locale,
        timeZone: parserContext.timeZone,
        todayDateKey: toDateKey(now),
        tomorrowDateKey: getTomorrowDateKey(now),
      });

      if (route.route === 'ask') {
        // Reuse the classifier result so the first Ask path has one classify call.
        const result = await askParser.ask(
          {
            question: input,
            conversationContext: [],
            now,
            locale: parserContext.locale,
            timeZone: parserContext.timeZone,
            todayDateKey: toDateKey(now),
            tomorrowDateKey: getTomorrowDateKey(now),
          },
          { precomputedClassification: classification },
        );
        setLastResult(result);
        setRoutedTo('ask');
      } else {
        await routeToCreate(input, route.reason);
      }
    } catch {
      setLastResult({
        outcome: 'unavailable',
        question: input,
        message: 'Auto request failed. No app entries changed.',
        reasonCode: 'request_failed',
      });
      setRoutedTo('ask');
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
        onChangeText={handleQuestionChange}
        accessibilityLabel="Auto mode question"
        disabled={isLoading}
      />
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        Auto sends your text to an AI provider for classification. If it routes to Ask, selected app
        facts may also be sent. If it routes to Create, the text is saved in recent commands on this
        device. An enabled remote Create parser may send it to a second AI provider. App actions
        require confirmation.
      </Text>
      <Button
        label={isLoading ? 'Sending…' : 'Send'}
        onPress={handleAutoSubmit}
        disabled={!hasQuestionText || isLoading}
      />

      {routedTo === 'create' ? (
        <Card
          variant="header"
          accentColor={tokens.textMuted}
          headerTitle="Auto → Create"
          headerSubtitle={createRouteReason ?? 'The same text was sent to Create.'}
          className="mb-0"
        >
          <View className="gap-3">
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              {createResult?.outcome === 'draft'
                ? 'Review the Create draft below before applying the action.'
                : 'Create could not prepare a draft. No app action ran.'}
            </Text>
            <Button
              label="Switch to Create"
              onPress={() => onSwitchToMode('create')}
              color={tokens.textMuted}
            />
            {createResult?.outcome === 'unsupported' || createResult?.outcome === 'unavailable' ? (
              <Button
                label="Try as Ask instead"
                onPress={retryAsAsk}
                color={tokens.textMuted}
                disabled={isLoading}
              />
            ) : null}
          </View>
        </Card>
      ) : lastResult ? (
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
          <View className="gap-3">
            <Text className="text-sm" style={{ color: tokens.textMuted }}>
              Ask did not change your app entries.
            </Text>
            {submittedText !== null ? (
              <Button
                label="Try as Create instead"
                onPress={() =>
                  void routeToCreate(submittedText, 'Retrying the same text as Create.')
                }
                color={tokens.textMuted}
                disabled={isLoading}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}
