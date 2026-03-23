import {
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Platform, ScrollView, View, type ViewStyle } from "react-native";
import {
  HORIZONTAL_SCROLL_CONTENT,
  HORIZONTAL_SCROLL_VIEWPORT_STYLE,
} from "@/lib/horizontalScrollViewportStyle";

export type HorizontalScrollAreaHandle = {
  scrollToEnd: (options?: { animated?: boolean }) => void;
};

type Props = PropsWithChildren<{
  /** Extra nodes rendered after the horizontal strip (e.g. legend) without participating in horizontal scroll. */
  footer?: ReactNode;
}>;

/** Web-only: extra styles; overflow uses Tailwind so horizontal scroll works in nested layouts. */
const WEB_OUTER_EXTRA = {
  overscrollBehaviorX: "contain",
  WebkitOverflowScrolling: "touch",
} as ViewStyle;

const WEB_INNER: ViewStyle = {
  alignSelf: "flex-start",
  flexShrink: 0,
};

export const HorizontalScrollArea = forwardRef<HorizontalScrollAreaHandle, Props>(
  function HorizontalScrollArea({ children, footer }, ref) {
    const nativeRef = useRef<ScrollView>(null);
    const webScrollId = `hscroll-${useId().replace(/:/g, "")}`;

    useImperativeHandle(
      ref,
      () => ({
        scrollToEnd: ({ animated = false } = {}) => {
          if (Platform.OS === "web" && typeof document !== "undefined") {
            const el = document.getElementById(webScrollId);
            if (el) {
              el.scrollLeft = el.scrollWidth - el.clientWidth;
            }
          } else {
            nativeRef.current?.scrollToEnd({ animated });
          }
        },
      }),
      [webScrollId],
    );

    const strip =
      Platform.OS === "web" ? (
        <View
          nativeID={webScrollId}
          className="w-full min-h-0 min-w-0 max-w-full shrink overflow-x-auto overflow-y-hidden"
          style={WEB_OUTER_EXTRA}
        >
          <View style={WEB_INNER}>{children}</View>
        </View>
      ) : (
        <ScrollView
          ref={nativeRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={HORIZONTAL_SCROLL_VIEWPORT_STYLE}
          contentContainerStyle={HORIZONTAL_SCROLL_CONTENT}
        >
          {children}
        </ScrollView>
      );

    return (
      <View className="w-full min-w-0 max-w-full" style={{ alignSelf: "stretch" }}>
        {strip}
        {footer}
      </View>
    );
  },
);
