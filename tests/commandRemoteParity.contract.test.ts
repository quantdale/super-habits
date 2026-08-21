import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DraftKind, DraftWarning } from '@/features/command/types';
import type { AskIntent } from '@/features/command/ask.types';
import { ASK_MAX_CONVERSATION_TURNS } from '@/features/command/ask.types';
import { normalizeRemoteParseResponse } from '@/features/command/realCommandParser';

// Source-level parity contract between the client command/ask surfaces and the
// two edge functions. These assertions would have caught AREA 6 Findings 1
// (missing planning kinds on the edge) and 5 (diverged warning allowlists):
//   - every DraftKind appears in the edge kind enum + prompt and normalizes
//     through the client;
//   - client warning allowlist == edge warning allowlist == DraftWarning union;
//   - client supported intents == edge VALID_INTENTS == AskIntent union;
//   - the conversation-turn cap matches the server bound.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const EDGE_PARSE_INDEX = readSource('supabase/functions/parse-ai-command/index.js');
const EDGE_PARSE_NORMALIZE = readSource('supabase/functions/parse-ai-command/normalize.js');
const EDGE_ASK_INDEX = readSource('supabase/functions/user-ai-ask/index.js');
const EDGE_ASK_NORMALIZE = readSource('supabase/functions/user-ai-ask/normalize.js');
const CLIENT_REAL_PARSER = readSource('features/command/realCommandParser.ts');
const CLIENT_ASK_PARSER = readSource('features/command/askParser.ts');

/** Extracts every quoted literal from the first source block matching pattern. */
function extractQuotedBlock(source: string, blockPattern: RegExp, label: string): string[] {
  const block = source.match(blockPattern);
  if (!block) throw new Error(`Parity contract could not locate ${label} in source.`);
  return [...block[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

// Compile-time exhaustive registries: adding a member to a union without
// updating its registry fails typecheck here.
const DRAFT_KIND_REGISTRY: Record<DraftKind, true> = {
  create_todo: true,
  complete_todo: true,
  create_habit: true,
  log_habit: true,
  log_calorie_entry: true,
  log_workout_routine: true,
  start_focus_session: true,
  create_project: true,
  update_goal_progress: true,
  add_todo_to_daily_plan: true,
};
const DRAFT_KINDS = Object.keys(DRAFT_KIND_REGISTRY) as DraftKind[];

const WARNING_CODE_REGISTRY: Record<DraftWarning['code'], true> = {
  todo_time_not_supported: true,
  unsupported_recurrence: true,
  ambiguous_date: true,
  defaulted_field: true,
  partial_parse: true,
  ambiguous_entity: true,
  missing_nutrition: true,
  active_timer_conflict: true,
  already_satisfied: true,
  off_day: true,
  percent_clamped: true,
};
const WARNING_CODES = Object.keys(WARNING_CODE_REGISTRY) as DraftWarning['code'][];

const ASK_INTENT_REGISTRY: Record<AskIntent, true> = {
  pending_todos: true,
  calorie_summary: true,
  habit_progress: true,
  workout_summary: true,
  focus_summary: true,
  daily_overview: true,
  habit_streak: true,
  project_status: true,
  goal_progress: true,
  today_focus: true,
};
const ASK_INTENTS = Object.keys(ASK_INTENT_REGISTRY) as AskIntent[];

const PARSE_INPUT_BASE = {
  rawText: 'Add a todo to call mom',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

/** Minimal valid remote payload per draft kind for the behavioral branch check. */
function buildMinimalDraftPayload(kind: DraftKind): Record<string, unknown> {
  const fieldsByKind: Record<DraftKind, Record<string, unknown>> = {
    create_todo: { title: 'call mom', notes: null, dueDate: null, priority: 'normal' },
    complete_todo: { todoTitle: 'Buy groceries' },
    create_habit: {
      name: 'Drink water',
      targetPerDay: 8,
      category: 'anytime',
      icon: null,
      color: null,
    },
    log_habit: { habitName: 'Read', dateKey: null },
    log_calorie_entry: {
      foodName: 'Eggs',
      calories: 140,
      protein: null,
      carbs: null,
      fats: null,
      fiber: null,
      mealType: null,
      consumedOn: null,
    },
    log_workout_routine: { routineName: 'Push Day', completedOn: null },
    start_focus_session: { durationMinutes: 25 },
    create_project: { name: 'Apollo', color: null, targetDate: null },
    update_goal_progress: { goalTitle: 'Read more', percent: 50 },
    add_todo_to_daily_plan: { todoTitle: 'Buy groceries', dateKey: null },
  };
  return {
    outcome: 'draft',
    kind,
    status: 'ready',
    confidence: 0.9,
    parserVersion: 'parity-test',
    warnings: [],
    missingFields: [],
    fields: fieldsByKind[kind],
  };
}

describe('command remote parity contract', () => {
  it('lists every DraftKind in the edge kind enum, the edge prompt, and normalizes it client-side', () => {
    const edgeEnumKinds = extractQuotedBlock(
      EDGE_PARSE_INDEX,
      /kind:\s*\{\s*type:\s*\["string",\s*"null"\],\s*enum:\s*\[([\s\S]*?)\]/,
      'edge parse kind enum',
    );

    const promptMatch = EDGE_PARSE_INDEX.match(/"Supported draft kinds are ([^"]+)\."/);
    if (!promptMatch) throw new Error('Parity contract could not locate the edge prompt kinds.');

    for (const kind of DRAFT_KINDS) {
      expect(edgeEnumKinds).toContain(kind);
      expect(promptMatch[1]).toContain(kind);
      // Behavioral: the client has a normalize branch that accepts this kind.
      const result = normalizeRemoteParseResponse(buildMinimalDraftPayload(kind), PARSE_INPUT_BASE);
      expect(result).toMatchObject({ outcome: 'draft', draft: { kind } });
    }

    // The enum must not advertise kinds the client cannot normalize.
    for (const edgeKind of edgeEnumKinds) {
      if (edgeKind === 'null') continue;
      expect(DRAFT_KINDS).toContain(edgeKind);
    }
  });

  it('keeps the client and edge warning allowlists equal to the DraftWarning union', () => {
    const clientCodes = extractQuotedBlock(
      CLIENT_REAL_PARSER,
      /SUPPORTED_WARNING_CODES: DraftWarning\['code'\]\[\] = \[([\s\S]*?)\];/,
      'client SUPPORTED_WARNING_CODES',
    );
    const edgeCodes = extractQuotedBlock(
      EDGE_PARSE_NORMALIZE,
      /SUPPORTED_WARNING_CODES = new Set\(\[([\s\S]*?)\]\)/,
      'edge SUPPORTED_WARNING_CODES',
    );

    expect(new Set(clientCodes)).toEqual(new Set(WARNING_CODES));
    expect(clientCodes).toHaveLength(WARNING_CODES.length);
    expect(new Set(edgeCodes)).toEqual(new Set(WARNING_CODES));
    expect(edgeCodes).toHaveLength(WARNING_CODES.length);
  });

  it('keeps client supported intents, edge VALID_INTENTS, and the AskIntent union equal', () => {
    const clientIntents = extractQuotedBlock(
      CLIENT_ASK_PARSER,
      /const supported = \[([\s\S]*?)\];/,
      'client supported intents',
    );
    const edgeIntents = extractQuotedBlock(
      EDGE_ASK_INDEX,
      /const VALID_INTENTS = \[([\s\S]*?)\];/,
      'edge VALID_INTENTS',
    );

    expect(new Set(clientIntents)).toEqual(new Set(ASK_INTENTS));
    expect(clientIntents).toHaveLength(ASK_INTENTS.length);
    expect(new Set(edgeIntents)).toEqual(new Set(ASK_INTENTS));
    expect(edgeIntents).toHaveLength(ASK_INTENTS.length);
  });

  it('matches the shared conversation-turn cap with the server bound', () => {
    const match = EDGE_ASK_NORMALIZE.match(/MAX_CONVERSATION_TURNS = (\d+)/);
    if (!match) throw new Error('Parity contract could not locate MAX_CONVERSATION_TURNS.');

    expect(Number(match[1])).toBe(ASK_MAX_CONVERSATION_TURNS);
  });
});
