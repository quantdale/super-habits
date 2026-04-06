import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

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

function borderStyle(accentColor: string | undefined) {
  return accentColor
    ? { borderWidth: 1.5 as const, borderColor: accentColor }
    : undefined;
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
  const extra = className?.trim() ?? "";
  const hasConsumerVerticalMargin = /\b(mb-|my-)/.test(extra);
  const marginClass = hasConsumerVerticalMargin ? "" : "mb-3";
  const borderClass = accentColor ? "" : "border-[1.5px] border-slate-200";

  const rootBase = [
    "overflow-hidden",
    "rounded-2xl",
    "bg-white",
    marginClass,
    "shadow-sm",
    "shadow-black/10",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

  const rootStyle: StyleProp<ViewStyle> = [borderStyle(accentColor), { elevation: 2 }, style];

  if (variant === "header") {
    return (
      <View
        className={[rootBase, borderClass].filter(Boolean).join(" ")}
        style={rootStyle}
      >
        <View
          className={`flex-row items-center justify-between ${PAD} ${accentColor ? "" : "bg-slate-600"}`}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        >
          <View className="min-w-0 flex-1 pr-2">
            <Text
              className={`text-base font-semibold ${accentColor ? "text-white" : "text-slate-900"}`}
              numberOfLines={2}
            >
              {headerTitle ?? ""}
            </Text>
            {headerSubtitle ? (
              <Text
                className={`mt-0.5 text-sm ${accentColor ? "text-white/80" : "text-slate-600"}`}
                numberOfLines={2}
              >
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          {headerRight != null ? (
            <View className="shrink-0 flex-row items-center self-start">{headerRight}</View>
          ) : null}
        </View>
        <View className={`${PAD} bg-white`}>{children}</View>
      </View>
    );
  }

  if (variant === "stat") {
    return (
      <View
        className={[rootBase, borderClass].filter(Boolean).join(" ")}
        style={rootStyle}
      >
        <View className="relative">
          {accentColor ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "50%",
                backgroundColor: accentColor,
                opacity: 0.1,
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
    <View
      className={[rootBase, borderClass].filter(Boolean).join(" ")}
      style={rootStyle}
    >
      <View className={bodyClass}>{children}</View>
    </View>
  );
}
