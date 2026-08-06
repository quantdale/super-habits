import { type ReactNode } from 'react';

import { View } from 'react-native';

export function CommandSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <View className={className}>{children}</View>;
}
