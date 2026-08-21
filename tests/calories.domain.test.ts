import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  kcalFromMacros,
  caloriesTotal,
  buildDailyTrend,
  buildMacroDonutData,
  calculateGoalProgress,
  filterSavedMeals,
  buildCalorieActivityDays,
  buildCalorieHeatmapDays,
  buildMacroTrendPoints,
  summarizeMacroTrend,
  normalizeMacroTargets,
  buildTargetProgress,
  parseMealCategory,
  listSavedMealCategories,
  sortSavedMealsForSearch,
  macroKcalShares,
} from '@/features/calories/calories.domain';
import type { DailySummary } from '@/features/calories/types';
import type { SavedMeal } from '@/core/db/types';

function meal(name: string, useCount = 1): SavedMeal {
  return {
    id: `smeal_${name}`,
    food_name: name,
    calories: 200,
    protein: 20,
    carbs: 10,
    fats: 5,
    fiber: 2,
    meal_type: 'breakfast',
    use_count: useCount,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

describe('caloriesTotal', () => {
  it('returns 0 for negative/NaN/overflow', () => {
    expect(
      caloriesTotal([{ calories: -100 }, { calories: NaN }, { calories: 1e20 }]),
    ).toBeGreaterThanOrEqual(0);
  });
  it('sums entries correctly', () => {
    const total = caloriesTotal([{ calories: 100 }, { calories: 250 }]);

    expect(total).toBe(350);
  });
});

describe('kcalFromMacros', () => {
  it('uses 4P + 4×max(0,C−F) + 2F + 9×fat', () => {
    expect(kcalFromMacros(0, 0, 0, 0)).toBe(0);
    expect(kcalFromMacros(10, 0, 0, 0)).toBe(40);
    expect(kcalFromMacros(0, 0, 10, 0)).toBe(90);
    expect(kcalFromMacros(0, 5, 0, 5)).toBe(10);
    expect(kcalFromMacros(0, 10, 0, 2)).toBe(36);
    expect(kcalFromMacros(10, 20, 5, 5)).toBe(155);
    expect(kcalFromMacros(0, 5, 0, 10)).toBe(20);
  });
});

describe('buildDailyTrend', () => {
  it('returns 365 entries by default', () => {
    expect(buildDailyTrend([])).toHaveLength(365);
  });

  it('fills missing days with 0', () => {
    const trend = buildDailyTrend([], 7);
    trend.forEach((d) => expect(d.value).toBe(0));
  });

  it('maps existing summary to correct day', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 1800,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const trend = buildDailyTrend(summaries, 7);
    const todayEntry = trend.find((t) => t.dateKey === todayKey);
    expect(todayEntry?.value).toBe(1800);
  });
});

describe('buildMacroDonutData', () => {
  it('returns empty array when all macros are 0', () => {
    expect(buildMacroDonutData(0, 0, 0, 0)).toHaveLength(0);
  });

  it('returns 4 slices, kcal from total carbs × 4, percents sum to 100 (P=30 C=50 F=10 Fi=5)', () => {
    const slices = buildMacroDonutData(30, 50, 10, 5);
    expect(slices).toHaveLength(4);
    expect(slices.reduce((s, sl) => s + sl.value, 0)).toBe(100);
    const p = slices.find((sl) => sl.label === 'Protein');
    const c = slices.find((sl) => sl.label === 'Carbs');
    const f = slices.find((sl) => sl.label === 'Fats');
    const fi = slices.find((sl) => sl.label === 'Fiber');
    expect(p?.kcal).toBe(120);
    expect(p?.grams).toBe(30);
    expect(c?.kcal).toBe(200);
    expect(c?.grams).toBe(50);
    expect(f?.kcal).toBe(90);
    expect(f?.grams).toBe(10);
    expect(fi?.kcal).toBe(10);
    expect(fi?.grams).toBe(5);
  });

  it('includes a carbs slice when fiber >= carbs (digestible would be 0)', () => {
    const slices = buildMacroDonutData(0, 10, 0, 10);
    expect(slices.find((sl) => sl.label === 'Carbs')).toMatchObject({
      kcal: 40,
      grams: 10,
    });
  });

  it('drops macros with zero kcal from the donut list', () => {
    const slices = buildMacroDonutData(0, 0, 10, 0);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.label).toBe('Fats');
    expect(slices.reduce((s, sl) => s + sl.value, 0)).toBe(100);
  });
});

describe('calculateGoalProgress', () => {
  it('returns 0 percent for zero goal', () => {
    expect(calculateGoalProgress(500, 0).percent).toBe(0);
  });

  it('calculates percent correctly', () => {
    expect(calculateGoalProgress(1000, 2000).percent).toBe(50);
  });

  it('caps at 100 percent when over goal', () => {
    expect(calculateGoalProgress(2500, 2000).percent).toBe(100);
  });

  it('flags over as true when actual exceeds goal', () => {
    expect(calculateGoalProgress(2500, 2000).over).toBe(true);
  });

  it('remaining is 0 when over goal', () => {
    expect(calculateGoalProgress(2500, 2000).remaining).toBe(0);
  });
});

describe('buildCalorieActivityDays', () => {
  it('marks days inactive with zero value when no summaries', () => {
    const days = buildCalorieActivityDays([], 2000, 7);
    expect(days).toHaveLength(7);
    expect(days.every((d) => !d.active && d.value === 0)).toBe(true);
  });

  it('sets active and caps value at 1 vs goal', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;

    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 1000,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const activity = buildCalorieActivityDays(summaries, 2000, 7);
    const todayEntry = activity.find((a) => a.dateKey === todayKey);
    expect(todayEntry?.active).toBe(true);
    expect(todayEntry?.value).toBe(0.5);
  });
});

describe('buildCalorieHeatmapDays', () => {
  it('maps calorie totals to intensity buckets vs goal', () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 500,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const heat = buildCalorieHeatmapDays(summaries, 2000, 30);
    const todayH = heat.find((h) => h.dateKey === todayKey);
    expect(todayH?.value).toBe(1);
  });
});

describe('filterSavedMeals', () => {
  const meals = [meal('Chicken breast'), meal('Chicken thigh'), meal('Oats'), meal('Greek yogurt')];

  it('returns all meals for empty query', () => {
    expect(filterSavedMeals(meals, '')).toHaveLength(4);
  });

  it('filters case-insensitively', () => {
    expect(filterSavedMeals(meals, 'chicken')).toHaveLength(2);
    expect(filterSavedMeals(meals, 'CHICKEN')).toHaveLength(2);
  });

  it('returns empty array when no match', () => {
    expect(filterSavedMeals(meals, 'pizza')).toHaveLength(0);
  });

  it('returns single match', () => {
    const result = filterSavedMeals(meals, 'oats');
    expect(result).toHaveLength(1);
    expect(result[0].food_name).toBe('Oats');
  });
});

describe('buildMacroTrendPoints', () => {
  const keyOffset = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('zero-fills days without entries and keeps oldest-first order', () => {
    const points = buildMacroTrendPoints(
      [
        {
          dateKey: keyOffset(0),
          totalCalories: 1800,
          totalProtein: 120,
          totalCarbs: 150,
          totalFats: 60,
          totalFiber: 20,
        },
      ],
      7,
    );
    expect(points).toHaveLength(7);
    expect(points[6].dateKey).toBe(keyOffset(0));
    expect(points[6].calories).toBe(1800);
    expect(points[0].calories).toBe(0);
    expect(points[0].protein).toBe(0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i - 1].dateKey < points[i].dateKey).toBe(true);
    }
  });

  it('ignores summaries outside the window', () => {
    const points = buildMacroTrendPoints(
      [
        {
          dateKey: keyOffset(45),
          totalCalories: 5000,
          totalProtein: 300,
          totalCarbs: 400,
          totalFats: 100,
          totalFiber: 10,
        },
      ],
      30,
    );
    expect(points.every((p) => p.calories === 0)).toBe(true);
  });
});

describe('summarizeMacroTrend', () => {
  it('returns zeros for an empty window', () => {
    expect(summarizeMacroTrend([])).toEqual({
      windowDays: 0,
      daysWithData: 0,
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
    });
  });

  it('averages over the full calendar window including zero days', () => {
    const points = [
      { dateKey: '2026-04-01', label: 'Apr 1', calories: 2000, protein: 100, carbs: 200, fats: 60 },
      { dateKey: '2026-04-02', label: 'Apr 2', calories: 1000, protein: 50, carbs: 100, fats: 30 },
      { dateKey: '2026-04-03', label: 'Apr 3', calories: 0, protein: 0, carbs: 0, fats: 0 },
    ];
    expect(summarizeMacroTrend(points)).toEqual({
      windowDays: 3,
      daysWithData: 2,
      avgCalories: 1000,
      avgProtein: 50,
      avgCarbs: 100,
      avgFats: 30,
    });
  });

  it('rounds macro averages to one decimal', () => {
    const points = [
      { dateKey: '2026-04-01', label: 'Apr 1', calories: 100, protein: 10, carbs: 10, fats: 5 },
      { dateKey: '2026-04-02', label: 'Apr 2', calories: 0, protein: 0, carbs: 0, fats: 0 },
    ];
    const summary = summarizeMacroTrend(points);
    expect(summary.avgProtein).toBe(5);
    expect(summary.avgFats).toBe(2.5);
  });
});

describe('normalizeMacroTargets', () => {
  it('returns null for absent or field-less input', () => {
    expect(normalizeMacroTargets(null)).toBeNull();
    expect(normalizeMacroTargets('junk')).toBeNull();
    expect(normalizeMacroTargets({})).toBeNull();
  });

  it('normalizes valid fields and clamps out-of-range ones to defaults', () => {
    expect(normalizeMacroTargets({ calories: 2400, protein: 160 })).toEqual({
      calories: 2400,
      protein: 160,
      carbs: 200,
      fats: 65,
    });
    expect(normalizeMacroTargets({ calories: 10_000_000 })?.calories).toBe(2000);
  });
});

describe('buildTargetProgress', () => {
  it('hides progress for non-positive targets', () => {
    expect(buildTargetProgress(50, 0)).toEqual({ percent: 0, remaining: 0, over: false });
    expect(buildTargetProgress(50, -5)).toEqual({ percent: 0, remaining: 0, over: false });
  });

  it('caps percent at 100 and reports over-target', () => {
    expect(buildTargetProgress(180, 150)).toEqual({
      percent: 100,
      remaining: 0,
      over: true,
    });
  });

  it('reports remaining grams under target', () => {
    expect(buildTargetProgress(90, 150)).toEqual({
      percent: 60,
      remaining: 60,
      over: false,
    });
  });

  it('treats NaN actual as zero', () => {
    expect(buildTargetProgress(NaN, 100).percent).toBe(0);
  });
});

describe('parseMealCategory', () => {
  it('extracts a leading "Category:" prefix', () => {
    expect(parseMealCategory('Breakfast: overnight oats')).toEqual({
      category: 'Breakfast',
      name: 'overnight oats',
    });
  });

  it('returns the raw name when no valid prefix exists', () => {
    expect(parseMealCategory('Chicken breast')).toEqual({ category: null, name: 'Chicken breast' });
    expect(parseMealCategory(': no category')).toEqual({ category: null, name: ': no category' });
    expect(parseMealCategory('Category:')).toEqual({ category: null, name: 'Category:' });
  });
});

describe('listSavedMealCategories', () => {
  it('returns distinct sorted categories, ignoring uncategorized meals', () => {
    const meals = [
      meal('Lunch: wrap'),
      meal('breakfast: oats'),
      meal('Lunch: salad'),
      meal('Plain'),
    ];
    expect(listSavedMealCategories(meals)).toEqual(['breakfast', 'Lunch']);
    expect(listSavedMealCategories([meal('Plain')])).toEqual([]);
  });
});

describe('sortSavedMealsForSearch', () => {
  const base = { ...meal('x'), calories: 0 };
  const mk = (name: string, useCount: number, lastUsed: string): SavedMeal => ({
    ...base,
    food_name: name,
    use_count: useCount,
    last_used_at: lastUsed,
  });

  it('puts prefix matches first, then use_count desc, then recency, then name', () => {
    const meals = [
      mk('Oat cookies', 5, '2026-01-01T00:00:00Z'),
      mk('Oats', 2, '2026-03-01T00:00:00Z'),
      mk('Toast', 9, '2026-02-01T00:00:00Z'),
      mk('Oat milk', 2, '2026-05-01T00:00:00Z'),
    ];
    const sorted = sortSavedMealsForSearch(meals, 'oat');
    expect(sorted.map((m) => m.food_name)).toEqual(['Oat cookies', 'Oat milk', 'Oats', 'Toast']);
    const noQuery = sortSavedMealsForSearch(meals);
    expect(noQuery[0].food_name).toBe('Toast');
  });
});

describe('macroKcalShares', () => {
  it('returns all zeros when every macro is zero', () => {
    expect(macroKcalShares(0, 0, 0, 0)).toEqual({ protein: 0, carbs: 0, fats: 0, fiber: 0 });
  });

  it('computes energy shares with digestible carbs only (4P/4C/2Fi/9F)', () => {
    // P 20g=80, C 30g with Fi 10g → digestible 20g=80, Fi 10g=20, F 10g=90; total 270
    const shares = macroKcalShares(20, 30, 10, 10);
    expect(shares.protein).toBe(30); // 80/270 ≈ 29.6
    expect(shares.carbs).toBe(30); // 80/270 ≈ 29.6
    expect(shares.fats).toBe(33); // 90/270 ≈ 33.3
    expect(shares.fiber).toBe(7); // 20/270 ≈ 7.4
  });

  it('clamps carbs below fiber so the carb share never goes negative', () => {
    const shares = macroKcalShares(0, 5, 0, 10);
    expect(shares.carbs).toBe(0);
    expect(shares.fiber).toBe(100);
  });
});

/**
 * CI runs under TZ=Asia/Manila (no DST), which can never exercise the
 * spring-forward boundary. Force a DST timezone and pin the window math:
 * date keys stay one local calendar day apart and labels anchor at local
 * noon, so the 23-hour day renders its own date (regression guard for the
 * UTC-drift bug class).
 */
describe('DST boundary (forced America/New_York)', () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
    vi.useFakeTimers();
    // US spring-forward: 2026-03-08 02:00 EST → EDT. Noon local on Mar 8 is
    // already EDT; the 7-day window [Mar 2 .. Mar 8] crosses the transition.
    vi.setSystemTime(new Date('2026-03-08T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = previousTz;
  });

  it('buildMacroTrendPoints keeps one-calendar-day steps across the transition', () => {
    const points = buildMacroTrendPoints([], 7);
    expect(points.map((p) => p.dateKey)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
    expect(points[5].label).toBe('Mar 7');
    expect(points[6].label).toBe('Mar 8');
  });

  it('buildMacroTrendPoints maps summaries onto the correct side of the transition', () => {
    const points = buildMacroTrendPoints(
      [
        {
          dateKey: '2026-03-07',
          totalCalories: 1500,
          totalProtein: 100,
          totalCarbs: 120,
          totalFats: 50,
          totalFiber: 10,
        },
      ],
      7,
    );
    expect(points[5].calories).toBe(1500);
    expect(points[5].protein).toBe(100);
    expect(points[6].calories).toBe(0);
  });

  it('buildDailyTrend stays noon-anchored across the transition', () => {
    const trend = buildDailyTrend(
      [
        {
          dateKey: '2026-03-08',
          totalCalories: 2100,
          totalProtein: 0,
          totalCarbs: 0,
          totalFats: 0,
          totalFiber: 0,
        },
      ],
      7,
    );
    expect(trend).toHaveLength(7);
    expect(trend[6].dateKey).toBe('2026-03-08');
    expect(trend[6].value).toBe(2100);
    expect(trend[6].label).toBe('Mar 8');
    expect(trend[5].label).toBe('Mar 7');
  });
});
