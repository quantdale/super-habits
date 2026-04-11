import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { SECTION_COLORS, SECTION_TEXT_COLORS } from "@/constants/sectionColors";
import { clearDemoData, seedDemoData } from "@/core/dev/seedDemoData";
import { Button } from "@/core/ui/Button";
import { FeaturePanel } from "@/core/ui/FeaturePanel";

type DemoAction = "seed" | "reset" | null;

export function OverviewDemoPanel({ onDataChanged }: { onDataChanged: () => Promise<void> }) {
  const [demoAction, setDemoAction] = useState<DemoAction>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const runDemoAction = useCallback(
    async (action: Exclude<DemoAction, null>) => {
      setDemoAction(action);
      setDemoError(null);

      try {
        if (action === "seed") {
          await seedDemoData();
        } else {
          await clearDemoData();
        }
        await onDataChanged();
      } catch (error) {
        console.error(`[OverviewDemoPanel] ${action} demo data failed`, error);
        setDemoError(error instanceof Error ? error.message : "Demo action failed");
      } finally {
        setDemoAction(null);
      }
    },
    [onDataChanged],
  );

  return (
    <FeaturePanel
      title="Demo Mode"
      subtitle="Local-only preview running separately from normal web dev."
      icon="science"
      accentColor={SECTION_COLORS.focus}
      textColor={SECTION_TEXT_COLORS.focus}
      className="mb-3"
    >
      <Text className="text-sm leading-5 text-slate-600">
        Seed realistic sample data on port 3001. Demo writes stay local and never sync.
      </Text>
      <View className="mt-4 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={demoAction === "seed" ? "Seeding..." : "Seed Demo Data"}
            onPress={() => {
              void runDemoAction("seed");
            }}
            color={SECTION_COLORS.focus}
            disabled={demoAction !== null}
          />
        </View>
        <View className="flex-1">
          <Button
            label={demoAction === "reset" ? "Resetting..." : "Reset Demo Data"}
            onPress={() => {
              void runDemoAction("reset");
            }}
            variant="danger"
            disabled={demoAction !== null}
          />
        </View>
      </View>
      {demoError ? (
        <Text className="mt-3 text-sm font-medium text-rose-600">{demoError}</Text>
      ) : null}
    </FeaturePanel>
  );
}
