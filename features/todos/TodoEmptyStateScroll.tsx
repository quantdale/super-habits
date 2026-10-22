import type { ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';

type Props = {
  children: ReactNode;
};

/**
 * Scroll region for the To Do EMPTY branch only.
 *
 * Why this exists as its own component instead of an inline `ScrollView` in
 * `TodosScreen`: the To Do screen must never contain a list-level scroll
 * container (that contract is pinned by the W6.5 list tests — the pending list
 * is a bounded virtualized `SectionList`/`DraggableFlatList`, not an eager
 * scroller). The *empty* state is a different problem: it is a short stack of
 * cards with no virtualized list, and it still has to stay reachable on a short
 * viewport (a landscape phone is ~390px tall, while the empty stack is ~440px
 * once the page header is included). Without a scroll region the "Add your
 * first task" action is clipped below the fold and cannot be reached.
 *
 * The To Do page deliberately pins `Screen scroll={false}` so its container
 * element type never changes across the empty<->populated transition; that is
 * what keeps the quick-add `TextInput` node (and its in-flight keystrokes)
 * alive. That pin removes the page-level scroller, so the empty branch supplies
 * its own, positioned AFTER the quick-add row so the input is never remounted
 * or scrolled away.
 *
 * `keyboardShouldPersistTaps` and the web keyboard-dismiss rules match the rest
 * of the app: on web a drag must not blur the input mid-typing.
 */
export function TodoEmptyStateScroll({ children }: Props) {
  return (
    <ScrollView
      className="min-h-0 flex-1"
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
      nestedScrollEnabled
      scrollEnabled
    >
      <View>{children}</View>
    </ScrollView>
  );
}
