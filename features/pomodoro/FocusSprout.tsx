import React from "react";
import { View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";
import type { PlantStage } from "./pomodoro.domain";

type Props = {
  progress: number; // 0–1
  stage: PlantStage;
  accentColor?: string; // default brand-500
  size?: number; // default 160
};

/**
 * SVG sprout that grows through 5 stages.
 * Each stage adds visual elements on top of previous ones.
 *
 * Layout (160×160 viewBox):
 *   - Soil: ellipse at y=130
 *   - Stem: vertical line growing from y=130 upward
 *   - Leaves: added at seedling+ stages
 *   - Crown: added at grown stage
 */
export function FocusSprout({
  progress,
  stage,
  accentColor = "#4f79ff",
  size = 160,
}: Props) {
  // Stem height grows from 0 to 80px based on progress
  // Minimum 4px so there's always something visible when started
  const stemHeight = Math.max(4, Math.round(progress * 80));
  const stemTop = 128 - stemHeight; // grows upward from soil
  const stemX = 80;

  // Leaf scale — appears at seedling, grows to full at grown
  const leafScale =
    stage === "seed" || stage === "sprout"
      ? 0
      : stage === "seedling"
        ? 0.6
        : stage === "growing"
          ? 0.85
          : 1.0;

  const soilColor = "#92764f";
  const stemColor = accentColor;
  const leafColor = "#22c55e"; // green-500
  const crownColor = accentColor;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 160 160">
        {/* Soil */}
        <Ellipse cx={80} cy={132} rx={36} ry={10} fill={soilColor} opacity={0.6} />

        {/* Stem — grows upward */}
        {stage !== "seed" && (
          <Line
            x1={stemX}
            y1={128}
            x2={stemX}
            y2={stemTop}
            stroke={stemColor}
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}

        {/* Seed bump (stage: seed only) */}
        {stage === "seed" && (
          <Ellipse cx={80} cy={128} rx={8} ry={6} fill={stemColor} opacity={0.8} />
        )}

        {/* Left leaf */}
        {leafScale > 0 && (
          <Path
            d={`M ${stemX} ${stemTop + 20}
                Q ${stemX - 22 * leafScale} ${stemTop + 10 * leafScale}
                  ${stemX - 28 * leafScale} ${stemTop + 24 * leafScale}
                Q ${stemX - 14 * leafScale} ${stemTop + 30 * leafScale}
                  ${stemX} ${stemTop + 20}`}
            fill={leafColor}
            opacity={0.9}
          />
        )}

        {/* Right leaf */}
        {leafScale > 0 && (
          <Path
            d={`M ${stemX} ${stemTop + 14}
                Q ${stemX + 22 * leafScale} ${stemTop + 4 * leafScale}
                  ${stemX + 28 * leafScale} ${stemTop + 18 * leafScale}
                Q ${stemX + 14 * leafScale} ${stemTop + 24 * leafScale}
                  ${stemX} ${stemTop + 14}`}
            fill={leafColor}
            opacity={0.9}
          />
        )}

        {/* Crown — appears only at grown stage */}
        {stage === "grown" && (
          <>
            <Circle cx={stemX} cy={stemTop - 10} r={18} fill={leafColor} opacity={0.85} />
            <Circle cx={stemX - 14} cy={stemTop - 4} r={12} fill={leafColor} opacity={0.75} />
            <Circle cx={stemX + 14} cy={stemTop - 4} r={12} fill={leafColor} opacity={0.75} />
            <Circle cx={stemX} cy={stemTop - 10} r={8} fill={crownColor} opacity={0.6} />
          </>
        )}
      </Svg>
    </View>
  );
}
