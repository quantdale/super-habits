import { PageHeader } from "@/core/ui/PageHeader";

type SectionTitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: SectionTitleProps) {
  return <PageHeader title={title} subtitle={subtitle} />;
}
