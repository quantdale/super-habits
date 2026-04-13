export type ActivityDay = {
  dateKey: string;
  active: boolean;
  value?: number;
};

export type HeatmapDay = {
  dateKey: string; // YYYY-MM-DD
  value: number; // 0 = none, 1 = low, 2 = medium, 3 = high
};
