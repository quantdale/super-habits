import { Text } from "react-native";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return (
    <>
      <Text className="text-2xl font-bold text-slate-900">{title}</Text>
      {subtitle ? <Text className="mb-4 mt-1 text-sm text-slate-600">{subtitle}</Text> : null}
    </>
  );
}
