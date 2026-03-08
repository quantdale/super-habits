import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

type ProgressRingProps = {
  size: number;
  strokeWidth: number;
  progress: number; // 0 to 1
  backgroundColor?: string;
  progressColor?: string;
};

export function ProgressRing({
  size,
  strokeWidth,
  progress,
  backgroundColor = "#e2e8f0",
  progressColor = "#94a3b8",
}: ProgressRingProps) {
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashOffset = circumference - Math.min(1, Math.max(0, progress)) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashOffset}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
