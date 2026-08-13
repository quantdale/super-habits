## MODIFIED Requirements

### Requirement: Two-call retrieval pipeline with no raw rows sent to the model

Every Ask question SHALL be answered via exactly two model calls: a classify
call that returns a structured `{intent, params}` result via schema-constrained
JSON, and a phrase call that receives only already-computed facts (never raw
database rows) and returns a structured `{answer}` result via schema-constrained
JSON. All arithmetic and data retrieval between the two calls SHALL happen in
client-side TypeScript against local SQLite, not inside either model call. Both
calls MUST occur only after the server has authenticated the user and consumed
the applicable request-class quota; rejected authentication or quota requests
MUST make zero model calls.

#### Scenario: Classify call receives only the question

- **WHEN** the classify call is made for the question "what have I eaten today?"
- **THEN** the request payload contains the question text (and prior turns, if
  any) and no stored user data.

#### Scenario: Phrase call receives computed facts, not rows

- **WHEN** the calorie summary retrieval for today returns a computed total of
  1800 kcal across 3 entries
- **THEN** the phrase call payload contains `{question, retrievedFacts:
{totalCalories: 1800, entryCount: 3, ...}}` and does not contain the
  individual `calorie_entries` rows.

#### Scenario: Authentication fails before either model call

- **WHEN** the user token is missing, malformed, or invalid
- **THEN** the request is rejected before classify or phrase provider calls and
  no paid model quota is consumed.

#### Scenario: Quota fails before either model call

- **WHEN** an authenticated user has exhausted the applicable Ask request
  quota
- **THEN** the request returns a rate-limit response before classify or phrase
  provider calls.

#### Scenario: Model cannot alter a computed total

- **WHEN** the phrase call returns an answer referencing a calorie total
- **THEN** the numeric total in the answer originates from the `retrievedFacts`
  computed by local TypeScript, not from a number invented by the model.
