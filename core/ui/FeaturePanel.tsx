import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Card } from "@/core/ui/Card";
<<<<<<< HEAD
=======
import { useAppTheme } from "@/core/theme";
>>>>>>> a74517a (dark mode, documentatiton, blank fix)

type FeaturePanelProps = {
  title: string;
  subtitle?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor: string;
  textColor: string;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function FeaturePanel({
  title,
  subtitle,
  icon,
  accentColor,
  textColor,
  headerRight,
  children,
  className,
  bodyClassName,
}: FeaturePanelProps) {
<<<<<<< HEAD
=======
  const { colors } = useAppTheme();

>>>>>>> a74517a (dark mode, documentatiton, blank fix)
  return (
    <Card
      accentColor={accentColor}
      className={["mb-0", className].filter(Boolean).join(" ")}
      innerClassName="p-0"
    >
      <View className="flex-1 p-4">
        <View className="flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
<<<<<<< HEAD
            style={{ backgroundColor: `${accentColor}18` }}
=======
            style={{ backgroundColor: `${accentColor}${colors.statusBarStyle === "dark" ? "24" : "18"}` }}
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
          >
            <MaterialIcons name={icon} size={22} color={textColor} />
          </View>
          <View className="min-w-0 flex-1">
<<<<<<< HEAD
            <Text className="text-base font-semibold text-slate-900">{title}</Text>
            {subtitle ? <Text className="mt-0.5 text-sm text-slate-500">{subtitle}</Text> : null}
=======
            <Text className="text-base font-semibold" style={{ color: colors.text }}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="mt-0.5 text-sm" style={{ color: colors.textMuted }}>
                {subtitle}
              </Text>
            ) : null}
>>>>>>> a74517a (dark mode, documentatiton, blank fix)
          </View>
          {headerRight ? (
            <View className="shrink-0 flex-row items-center self-start">{headerRight}</View>
          ) : null}
        </View>
        <View className={["mt-4", bodyClassName].filter(Boolean).join(" ")}>{children}</View>
      </View>
    </Card>
  );
}
