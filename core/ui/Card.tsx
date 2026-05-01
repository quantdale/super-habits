import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";
import { useAppTheme } from "@/core/providers/ThemeProvider";

export type CardVariant = "standard" | "header" | "stat";

type CardProps = {
  children: ReactNode;
  accentColor?: string;
  className?: string;
  variant?: CardVariant;
  headerTitle?: string;
  /** Shown below `headerTitle` in the accent bar (header variant only). */
  headerSubtitle?: string;
  headerRight?: ReactNode;
  /** Merged onto the outer card `View` (border/elevation applied first). */
  style?: StyleProp<ViewStyle>;
  /** Standard variant only: replaces default inner `p-4` when set (e.g. `p-0`). */
  innerClassName?: string;
};

const PAD = "p-4";

function withAlpha(color: string, opacity: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}

export function Card({
  children,
  accentColor,
  className,
  variant = "standard",
  headerTitle,
  headerSubtitle,
  headerRight,
  style,
  innerClassName,
}: CardProps) {
  const { tokens } = useAppTheme();
  const extra = className?.trim() ?? "";
  const hasConsumerVerticalMargin = /\b(mb-|my-)/.test(extra);
  const marginClass = hasConsumerVerticalMargin ? "" : "mb-4";
  const accentTint = accentColor ? withAlpha(accentColor, 0.08) : undefined;
  const accentHeaderTint = accentColor ? withAlpha(accentColor, 0.06) : tokens.surfaceElevated;

  const rootBase = [
    "relative",
    "overflow-hidden",
    "rounded-2xl",
    marginClass,
    "shadow-sm",
    "shadow-black/5",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  const rootStyle: StyleProp<ViewStyle> = [
    {
      elevation: 1,
      backgroundColor: tokens.surface,
      borderColor: tokens.border,
      borderWidth: 1,
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.05,
      shadowRadius: 14,
    },
    style,
  ];

  if (variant === "header") {
    return (
      <View className={rootBase} style={rootStyle}>
        {accentColor ? (
          <>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                backgroundColor: accentColor,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 4,
                left: 0,
                right: 0,
                height: 72,
                backgroundColor: accentTint,
              }}
            />
          </>
        ) : null}
        <View
          className={`flex-row items-start justify-between gap-3 px-4 pb-3 pt-5`}
          style={{ backgroundColor: accentHeaderTint }}
        >
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className="text-base font-semibold"
              style={{ color: tokens.text }}
              numberOfLines={2}
            >
              {headerTitle ?? ""}
            </Text>
            {headerSubtitle ? (
              <Text
                className="mt-0.5 text-sm"
                style={{ color: tokens.textMuted }}
                numberOfLines={2}
              >
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          {headerRight != null ? (
            <View
              className="shrink-0 self-start rounded-full px-3 py-2"
              style={{
                backgroundColor: accentColor ?? tokens.surface,
                borderColor: accentColor ? withAlpha(accentColor, 0.22) : tokens.border,
                borderWidth: accentColor ? 0 : 1,
              }}
            >
              <View className="flex-row items-center justify-center">{headerRight}</View>
            </View>
          ) : null}
        </View>
        <View className="px-4 pb-4 pt-2" style={{ backgroundColor: tokens.surface }}>{children}</View>
      </View>
    );
  }

  if (variant === "stat") {
    return (
      <View className={rootBase} style={rootStyle}>
        {accentColor ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: accentColor,
            }}
          />
        ) : null}
        <View className="relative">
          {accentColor ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "56%",
                backgroundColor: accentTint,
              }}
            />
          ) : null}
          <View
            className={`relative ${PAD} items-center justify-center bg-transparent`}
            style={{ zIndex: 1 }}
          >
            {children}
          </View>
        </View>
      </View>
    );
  }

  const bodyClass = innerClassName !== undefined ? innerClassName : PAD;

  return (
    <View className={rootBase} style={rootStyle}>
      {accentColor ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: accentColor,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 4,
              left: 0,
              right: 0,
              height: 64,
              backgroundColor: accentTint,
            }}
          />
        </>
      ) : null}
      <View className={bodyClass}>{children}</View>
    </View>
  );
}
