import { callAskFunction, normalizeClassifyPayload } from './askParser';
import type { AskParseInput, AskResult, ClassifyResult } from './ask.types';

/**
 * Auto-mode classifier: given a natural-language input, calls the edge
 * function's classify stage to decide whether the user's question routes to
 * the Ask pipeline (pending_todos / calorie_summary / habit_progress /
 * workout_summary / focus_summary / daily_overview / project_status /
 * goal_progress / today_focus) or the Create pipeline (everything else,
 * including unrecognized input that the classify stage marks unsupported).
 *
 * The edge function's classify result determines the route:
 *   - "classified"  → route: 'ask', intent carried through
 *   - "unsupported" → route: 'create' (the command parser is the fallback)
 *   - unavailable   → bubble the error
 *
 * On the UI side, an auto-mode result view shows a single alternate-mode retry
 * affordance: "Try as Create instead" when Ask ran, "Try as Ask instead" when
 * Create ran — re-submitting the exact same input text through the other
 * pipeline without the user retyping anything.
 */

export type AutoRoute = { route: 'ask'; intent: string } | { route: 'create'; reason: string };

export interface AutoModeResult<T = unknown> {
  route: AutoRoute;
  askResult?: AskResult;
  createResult?: T; // T = ParseCommandResult from commandParser.parse
}

/**
 * Classifies the raw input and returns a route decision. Does NOT execute
 * the full pipeline — the caller dispatches to askParser.ask or
 * commandParser.parse based on the route, then attaches the result to the
 * returned AutoModeResult via `withResult`. When the route is 'ask' the
 * classification itself is returned too, so the caller can hand it to
 * `askParser.ask` as `precomputedClassification` instead of classifying twice.
 */
export async function classifyForAutoMode(input: AskParseInput): Promise<{
  route: AutoRoute;
  classification?: ClassifyResult;
}> {
  const classifyCall = await callAskFunction({
    stage: 'classify',
    question: input.question,
    conversationContext: input.conversationContext,
    nowIso: input.now.toISOString(),
    locale: input.locale,
    timeZone: input.timeZone,
    todayDateKey: input.todayDateKey,
    tomorrowDateKey: input.tomorrowDateKey,
  });

  if (!classifyCall.ok) {
    // If classification itself failed, fall back to Create (the user typed
    // *something* — treat it as a potential command).
    return {
      route: {
        route: 'create',
        reason: 'Classification unavailable — routing to Create as fallback.',
      },
    };
  }

  let classifyResult: ClassifyResult;
  try {
    classifyResult = normalizeClassifyPayload(classifyCall.payload, input);
  } catch {
    return {
      route: {
        route: 'create',
        reason: 'Classification produced an invalid response — routing to Create as fallback.',
      },
    };
  }

  if (classifyResult.outcome === 'unsupported') {
    return {
      route: {
        route: 'create',
        reason: classifyResult.reason ?? 'Not an Ask intent — routing to Create.',
      },
    };
  }

  return {
    route: {
      route: 'ask',
      intent: classifyResult.intent,
    },
    classification: classifyResult,
  };
}

/**
 * Wraps an AutoRoute with the result from the dispatched pipeline. Used by
 * the UI to surface the actual AskResult or ParseCommandResult alongside
 * the route decision, so the "try as other mode" retry affordance has the
 * original input text available.
 */
export function withAutoResult<T>(
  route: AutoRoute,
  result: AskResult | T,
  routeKey: 'ask' | 'create',
): AutoModeResult<T> {
  return {
    route,
    ...(routeKey === 'ask' ? { askResult: result as AskResult } : { createResult: result as T }),
  };
}
