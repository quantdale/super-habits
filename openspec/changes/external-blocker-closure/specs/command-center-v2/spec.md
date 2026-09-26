## ADDED Requirements

### Requirement: Parse production readiness requires authenticated evaluation

The parse path MUST treat `OPENAI_API_KEY` and `AI_COMMAND_MODEL` as its required provider configuration. The campaign MUST NOT print those values, commit them, or write them to logs. It MUST NOT change the production model default, send billable provider traffic, or enable default-on command execution without owner authorization. Production parse readiness MUST NOT be claimed until authenticated evaluation has passed the existing gates for intent accuracy, unsupported and ambiguous requests, structured output, confirmation boundaries, unsafe-action prevention, prompt-injection resistance, and forced-provider failure. When the provider is unavailable, deterministic, mock, and static-security results MUST stay labeled as non-production evidence.

#### Scenario: The parse provider is unavailable

- **WHEN** parse returns a provider-unavailable result and no valid provider configuration is present
- **THEN** production parse readiness is not claimed

#### Scenario: Default-on is not authorized

- **WHEN** evaluation evidence is green and the owner has not authorized default-on execution
- **THEN** default-on command execution stays off
