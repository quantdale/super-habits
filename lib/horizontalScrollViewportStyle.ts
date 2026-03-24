import type { ViewStyle } from "react-native";

/** Native horizontal ScrollView viewport (bounded width inside flex layout). */
export const HORIZONTAL_SCROLL_VIEWPORT_STYLE: ViewStyle = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  flexShrink: 1,
};

export const HORIZONTAL_SCROLL_CONTENT: ViewStyle = {
  flexGrow: 0,
  alignItems: "flex-start",
};
