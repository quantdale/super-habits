import { Children, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme } from '@/core/providers/themeContext';
import { radius } from '@/core/theme/designTokens';

export type ListGroupProps = {
  /** `ListRow` elements (or any row-shaped nodes). */
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * ListGroup (v2 §6): one `depth.flat` card (2px `border` ring, radius 16 —
 * §5.6 "list cards", no lip, no blur shadow) whose rows are separated by
 * hairline 1px `border` dividers. Never nest another card inside it.
 */
export function ListGroup({ children, className, style, testID }: ListGroupProps) {
  const { tokens } = useAppTheme();
  const rows = Children.toArray(children);

  return (
    <View
      testID={testID}
      className={['overflow-hidden', className].filter(Boolean).join(' ')}
      style={[
        {
          borderRadius: radius.md,
          borderWidth: 2,
          borderColor: tokens.border,
          backgroundColor: tokens.surface,
        },
        style,
      ]}
    >
      {rows.map((row, index) => (
        <View
          key={index}
          style={
            index === rows.length - 1
              ? undefined
              : { borderBottomWidth: 1, borderBottomColor: tokens.border }
          }
        >
          {row}
        </View>
      ))}
    </View>
  );
}
