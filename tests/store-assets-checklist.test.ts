import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checklistPath = resolve(repositoryRoot, 'docs', 'release', 'store-assets-checklist.md');
const declarationsPath = resolve(repositoryRoot, 'docs', 'release', 'store-data-declarations.md');
const readinessPath = resolve(repositoryRoot, 'docs', 'release', 'app-store-readiness.md');

function readChecklist(): string {
  return readFileSync(checklistPath, 'utf8');
}

describe('store assets checklist', () => {
  it('ships the verifiable spec without fabricating image binaries', () => {
    expect(existsSync(checklistPath)).toBe(true);
    const checklist = readChecklist();
    expect(checklist).toContain('verifiable spec only');
    expect(checklist).toContain('[OWNER ACTION]');
    // No image binaries ship: no PNG files are claimed to exist.
    expect(checklist).toContain('No image binaries ship');
    expect(checklist).not.toMatch(/!\[[^\]]*\]\(.*\.png\)/i);
  });

  it('cites the current required Apple display classes and Play dimensions', () => {
    const checklist = readChecklist();
    expect(checklist).toContain('Apple screenshot specifications');
    expect(checklist).toContain('6.9" iPhone — primary iPhone set');
    expect(checklist).toContain('6.5" iPhone — fallback if no 6.9" set');
    expect(checklist).toContain('13" iPad — required');
    expect(checklist).toContain('6.3" iPhone — optional additional set');
    expect(checklist).toContain('1290 × 2796');
    expect(checklist).toContain('1179 × 2556');
    expect(checklist).toContain('2048 × 2732');
    expect(checklist).toContain('2064 × 2752');
    expect(checklist).toContain('1024 × 500');
    expect(checklist).toContain('one to 10');
    expect(checklist).toContain('Min 2');
    expect(checklist).not.toContain('6.7" iPhone (required)');
    expect(checklist).not.toContain('6.1" iPhone (required)');
  });

  it('maps the six preferred surfaces to real screens', () => {
    const checklist = readChecklist();
    expect(checklist).toContain('features/overview/OverviewScreen.tsx');
    expect(checklist).toContain('features/habits/HabitsScreen.tsx');
    expect(checklist).toContain('features/pomodoro/PomodoroScreen.tsx');
    expect(checklist).toContain('features/workout/WorkoutSessionScreen.tsx');
    expect(checklist).toContain('features/calories/CaloriesScreen.tsx');
    expect(checklist).toContain('features/gamification/AchievementsScreen.tsx');
    expect(checklist).toContain('app/index.tsx');
    expect(checklist).toContain('Today');
    expect(checklist).toContain('Level & Achievements');
  });

  it('states capture acceptance and keeps capture owner-bound', () => {
    const checklist = readChecklist();
    expect(checklist).toContain('1.0.0');
    expect(checklist).toContain('English');
    expect(checklist).toContain('Seeded demo content only');
    expect(checklist).toContain('No real PII');
    expect(checklist).toContain('Status bar neutral');
    expect(checklist).toContain('Default or clearly-shown theme');
    expect(checklist).toContain('source SHA');
    expect(checklist).toContain('genuine build');
    expect(checklist).toContain('[OWNER ACTION]');
    const declarations = readFileSync(declarationsPath, 'utf8');
    expect(declarations).toContain('store-assets-checklist.md');
    const readiness = readFileSync(readinessPath, 'utf8');
    expect(readiness).toContain('store-assets-checklist.md');
    expect(readiness).toContain('delivered 2026-09-19');
  });
});
