import { Text, View } from 'react-native';
import { Card } from '@/core/ui/Card';
import { useAppTheme } from '@/core/providers/themeContext';
import {
  type CommandCenterLaunchContext,
  getCommandCenterContextCopy,
} from './commandCenterConfig';
import type { CommandParseObservation } from './types';

export function PreviewSectionTitle({ children }: { children: string }) {
  const { tokens } = useAppTheme();
  return (
    <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
      {children}
    </Text>
  );
}

export function PreviewInfoRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="flex-row items-start justify-between gap-3 rounded-xl border px-3 py-2.5"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      <Text className="text-sm font-medium" style={{ color: tokens.textMuted }}>
        {label}
      </Text>
      <Text className="flex-1 text-right text-sm" style={{ color: tokens.text }}>
        {value}
      </Text>
    </View>
  );
}

export function PreviewWarning({ message }: { message: string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: tokens.warningBorder, backgroundColor: tokens.warningBackground }}
    >
      <Text className="text-sm" style={{ color: tokens.warningText }}>
        {message}
      </Text>
    </View>
  );
}

export function PreviewMissingField({ message }: { message: string }) {
  const { tokens } = useAppTheme();
  return (
    <View
      className="rounded-xl border px-3 py-2.5"
      style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
    >
      <Text className="text-sm" style={{ color: tokens.textMuted }}>
        {message}
      </Text>
    </View>
  );
}

export function LaunchContextCard({
  launchContext,
}: {
  launchContext: CommandCenterLaunchContext;
}) {
  const { tokens } = useAppTheme();
  const contextCopy = getCommandCenterContextCopy(launchContext);

  if (!contextCopy) return null;

  return (
    <Card accentColor={contextCopy.accentColor} className="mb-0">
      <Text
        className="text-xs font-semibold uppercase tracking-[1px]"
        style={{ color: tokens.textMuted }}
      >
        Current section
      </Text>
      <Text className="mt-1 text-base font-semibold" style={{ color: tokens.text }}>
        {contextCopy.sectionLabel}
      </Text>
      <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
        {contextCopy.helperCopy}
      </Text>
    </Card>
  );
}

export function InternalMetadataCard({ observation }: { observation: CommandParseObservation }) {
  const { tokens } = useAppTheme();
  return (
    <Card
      variant="header"
      accentColor={tokens.textMuted}
      headerTitle="Internal parser metadata"
      headerSubtitle="Visible only when internal rollout mode is enabled on this device."
      className="mb-0"
    >
      <View className="gap-3">
        <PreviewInfoRow label="Effective path" value={observation.effectivePath} />
        <PreviewInfoRow label="Outcome" value={observation.outcome} />
        <PreviewInfoRow label="Draft status" value={observation.draftStatus ?? 'n/a'} />
        <PreviewInfoRow
          label="Latency"
          value={`${observation.latencyMs} ms (${observation.latencyBucket})`}
        />
        <PreviewInfoRow label="Reason code" value={observation.reasonCode ?? 'none'} />
        <PreviewInfoRow
          label="Warning codes"
          value={observation.warningCodes.length > 0 ? observation.warningCodes.join(', ') : 'none'}
        />
        <PreviewInfoRow
          label="Missing fields"
          value={
            observation.missingFieldNames.length > 0
              ? observation.missingFieldNames.join(', ')
              : 'none'
          }
        />
      </View>
    </Card>
  );
}
