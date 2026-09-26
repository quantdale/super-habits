# AI Command Center privacy analysis and rollout draft

**Status:** technical draft, 2026-09-25. This is source-based analysis for the
owner and counsel. It is not an approved privacy policy, provider contract
review, production certification, or authorization to send billable traffic.

## Current implementation and evidence boundary

| Path                | Source behavior                                                                                                                                                                                                                 | Current gate                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create remote parse | `parse-ai-command/index.js` sends a user command and date/locale context to an OpenAI-compatible chat completion; the client falls back to the local parser if remote parsing is unavailable.                                   | `commandConfig.ts` defaults to `mock`; client remote use requires its internal rollout and local preference. The Edge Function also requires `AI_COMMAND_INTERNAL_ROLLOUT=true` and the authenticated UID in `AI_INTERNAL_USER_IDS` before body, quota, or provider work. Production lacks both parse provider secrets.                                                                                                       |
| Ask and Auto        | `user-ai-ask/index.js` classifies a question and may phrase an answer with local facts through DeepSeek v4 Flash via the OpenCodeGo gateway. Some planning answers are formatted locally after classification (`askParser.ts`). | Ordinary builds hide Ask/Auto; `EXPO_PUBLIC_AI_ASK_INTERNAL_ROLLOUT=true` is a build/distribution opt-in, not an on-device preference. The Edge Function separately requires `AI_ASK_INTERNAL_ROLLOUT=true` and the authenticated UID in `AI_INTERNAL_USER_IDS` before body, quota, or provider work. The dummy-host export opts in for mocked tests only. The production Ask key is present by name; validity is unverified. |

The above describes current source and a read-only **name-presence** check on
project `kruubbynsmxzxfdunaal`; it does not prove what code or flags are
deployed. A previously deployed build or Edge Function may still expose or
serve Ask/Auto until replaced; the new source gate does not change that remote
state on its own.
No authenticated provider evaluation was run in this campaign.

## What would leave the device on explicit remote use

- **Create parse:** `rawText` (maximum 280 characters), `nowIso`, locale,
  time zone, and today/tomorrow date keys travel through the Supabase Edge
  Function to the configured OpenAI-compatible endpoint. The user text can
  itself contain names, health details, notes, or other personal data. The
  provider request uses a server-side API key and `store: false`; the user
  bearer token stays on the Supabase request, not in the model prompt.
- **Ask classify:** the question (maximum 280 characters), up to 20 prior
  question/answer turns, date/time/locale context, and intent instructions
  travel through the Edge Function to the DeepSeek gateway. That history is
  held in app memory and cleared on restart (`AskConversationView.tsx` and
  `AskConversationContext.tsx`); classification still sends it upstream.
- **Ask phrase:** the current question and a bounded `retrievedFacts` object
  (source check limits its serialized length to 24,000 characters) travel to
  the same gateway for supported fact intents. Facts can include task/habit
  names, calorie or workout summaries, focus history, and daily totals;
  `ask.retrieval.ts` determines each exact shape. Project, goal, and today
  focus planning intents instead format answers locally after classification,
  but their question was still sent for classification.
- **Operational authentication/quota:** both functions validate a Supabase
  bearer session before parsing a body and consume an owner-scoped quota
  before provider work (`_shared/aiSecurity.js`). The quota RPC necessarily
  handles the authenticated user ID and request class. The provider call does
  not include the Supabase user ID in its JSON body.

The model-inference boundary is the provider response. It is an untrusted
draft/classification/phrase, never an authoritative database read or write.
The client revalidates parse output; Create still requires review and explicit
confirmation before canonical data-layer execution. Ask retrieves bounded
facts from local SQLite and has deterministic fallback for supported answers.

## Retention and logs

Both provider requests set `store: false`, but that parameter alone does not
establish the providers' retention, abuse-monitoring, training, subcontractor,
or deletion terms. The owner or counsel must verify the actual OpenAI endpoint
and OpenCodeGo/DeepSeek agreement, regions, retention settings, subprocessors,
and deletion channel before approving public disclosure or rollout. Do not
promise zero provider retention from source code alone.

Edge logs record an event name, request ID, input length, stage or outcome,
HTTP status, latency, and in some successful cases intent or reason code.
After the 2026-09-25 fix, provider error bodies and exception messages are not
logged by these functions. The focused regression passes synthetic sentinel
values through error and malformed-output paths. No raw command, question,
retrieved fact, or provider response should be added to operational logs.
Platform, proxy, and provider-side logs still require an operator inventory;
this source review does not prove their retention or contents.

Earlier release drafts described backup as the only optional off-device
content path. The 2026-09-25 drafts in `docs/release/privacy-policy.md`,
`docs/release/store-data-declarations.md`, and `public/privacy.html` now
describe configured automatic Auth/backup and conditional AI requests. Before
an AI-enabled release, the owner must verify the exact build and provider
terms, then approve the policy, hosted copy, and store answers. Those answers
must reflect the AI-enabled build, not a local-only test export. This analysis
is separate from owner and legal sign-off.

## Proposed staged rollout (not authorized)

1. **Stay off by default.** Ordinary builds hide Ask/Auto and use mock Create
   parsing. Both Edge Functions deny authenticated callers unless their own
   server flag is exactly `true` and the UID is in `AI_INTERNAL_USER_IDS`.
   The dummy-host `dist-sync` client opt-in is test-only. Do not set production
   flags, allowlist, model defaults, or provider credentials from this document.
2. **Prepare a bounded internal lane.** Owner approves a provider test budget
   and valid, least-privilege secret provisioning. Prove the disposable target
   identity and isolation before any write-capable setup. Use synthetic data.
   Run the existing internal eval/observation describes and separate Ask safety
   rows; preserve artifacts, exact source SHA, model IDs, host, and sample size.
3. **Apply go/no-go gates.** Parse: zero unexpected mismatches on the pinned
   intent/ambiguity/destructive corpus, no write before confirmation, and
   forced provider failure with honest fallback. Ask: zero unsafe claims,
   privacy echoes, or local writes in the safety corpus; correct fact bounds
   and isolation. Measure p50/p95 request and end-to-end latency, success and
   fallback rates, 401/429/5xx rates, provider input/output tokens, and actual
   charges. Compare latency with the current 4.5-second client deadlines and
   local fallback. A tiny corpus is a regression gate, not statistical proof
   of population accuracy; expand before public rollout. The owner must set
   numerical tolerances and an approved budget from measured evidence.
4. **Check quotas and costs.** Current server quota is 30 parse, 20 Ask
   classify, and 20 Ask phrase requests per user per hour; a normal Ask can
   consume both classify and phrase requests. Ask may retry a gateway request
   up to three attempts after one quota consumption. Quota RPC failure is
   fail-closed. Calculate worst-case provider spend with the actual model
   price and observed tokens, including retries, before increasing traffic.
   Add alerts on quota failures, high retry rate, charge rate, and latency.
5. **Approve disclosure and flags separately.** Owner/counsel sign off the
   policy, hosted copy, and store forms. Owner then authorizes a specific
   build SHA, both client and server flag values, the authenticated UID
   allowlist, provider budget, and monitoring window. Deploy and verify the
   default-off server functions before any internal opt-in. Public default-on
   would require a separately reviewed server access policy and explicit gate;
   the current allowlist only supports internal users.
6. **Observe and respond.** During the approved window, monitor only metadata
   counters from the functions and client fallback observations. Sample
   failures with synthetic reproductions, not user prompt logs. On unsafe
   output, privacy leak, quota abuse, elevated provider errors, latency beyond
   the client deadline, or spending above budget: stop promotion, disable the
   server rollout flags, remove internal UIDs from the allowlist, revert the
   public Ask build, return Create to `mock`, and disable or rotate provider
   secrets if needed. Record
   incident start/end, affected SHA/cohort, counters, containment, and owner
   notification. The already-installed binary/web cache may require a new
   release or service-worker update for a build-time Ask flag; a local test of
   flag-off rollback on each platform is required before default-on.

**Owner actions remaining:** approve provider traffic budget; provision and
validate the parse secret pair; verify Ask key and provider contracts; approve
privacy wording and store declarations; set numerical quality/cost thresholds;
authorize a bounded rollout and rollback drill. Presence of one Ask secret
does not satisfy those gates.
