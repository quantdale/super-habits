## ADDED Requirements

### Requirement: Ask production readiness requires its own provider proof

The ask path MUST treat `DEEPSEEK_API_KEY` as its required provider configuration. The parse provider configuration MUST NOT be treated as sufficient for ask. Secrets MUST NOT be printed, committed, or logged. The campaign MUST complete a scoped privacy analysis naming the provider, the data transmitted, retention assumptions, operational logs, and the model-inference boundary, and MUST keep that analysis separate from owner or legal approval. Production ask readiness MUST NOT be claimed, and default-on ask behavior MUST NOT be enabled, until authenticated evaluation passes and the owner authorizes rollout. The rollout plan MUST include monitoring, quota enforcement, feature flags, incident response, and rollback.

#### Scenario: Only the parse provider is configured

- **WHEN** the parse provider configuration is present and `DEEPSEEK_API_KEY` is not
- **THEN** ask remains uncertified

#### Scenario: Privacy text is only a draft

- **WHEN** the privacy analysis is written and the owner or counsel has not approved the disclosure
- **THEN** the draft is not legal approval and is not production ask readiness
