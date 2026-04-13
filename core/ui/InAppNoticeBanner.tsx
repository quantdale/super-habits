import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { useInAppNotices } from "@/core/providers/InAppNoticeProvider";
import { useAppTheme } from "@/core/providers/ThemeProvider";

const NOTICE_ACCENT = "#2563eb";

function formatContextLabel(label?: string, fallbackFeature?: string) {
  return label?.trim() || fallbackFeature || "item";
}

export function InAppNoticeBanner() {
  const router = useRouter();
  const { tokens } = useAppTheme();
  const { currentNotice, dismissNotice } = useInAppNotices();

  if (!currentNotice) return null;

  const { id, onPress, payload } = currentNotice;
  const sourceLabel = formatContextLabel(payload.source.label, payload.source.feature);
  const targetLabel = formatContextLabel(payload.target.label, payload.target.feature);
  const destinationHref = payload.destination?.href;

  const handlePress = () => {
    dismissNotice(id);
    if (onPress) {
      onPress();
      return;
    }
    if (destinationHref) {
      router.push(destinationHref);
    }
  };

  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
    >
      <View pointerEvents="box-none" className="px-3 pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={payload.message}
          className="overflow-hidden rounded-2xl border"
          onPress={handlePress}
          style={{
            borderColor: NOTICE_ACCENT,
            backgroundColor: tokens.surface,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View className="flex-row items-start gap-3 px-4 py-3">
            <View
              className="mt-0.5 h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${NOTICE_ACCENT}16` }}
            >
              <MaterialIcons name="bolt" size={20} color={NOTICE_ACCENT} />
            </View>

            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
                {payload.message}
              </Text>
              <Text className="mt-1 text-sm" style={{ color: tokens.textMuted }}>
                {payload.reason}
              </Text>
              <Text className="mt-2 text-xs font-medium uppercase" style={{ color: NOTICE_ACCENT }}>
                {sourceLabel} to {targetLabel}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice"
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                dismissNotice(id);
              }}
            >
              <MaterialIcons name="close" size={20} color={tokens.iconMuted} />
            </Pressable>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
