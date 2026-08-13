## Purpose

Protect paid server-side AI requests with explicit user authentication,
durable per-user abuse control, bounded inputs, and non-leaking failures.

## ADDED Requirements

### Requirement: AI requests authenticate before provider invocation

Every paid AI Edge Function request MUST require a valid authenticated
SuperHabits user and MUST verify that identity before calling an upstream model
provider. CORS configuration or a gateway default MUST NOT be the sole
authentication guarantee.

#### Scenario: Missing or malformed authorization is rejected

- **WHEN** an AI request has no bearer token or has a malformed authorization
  header
- **THEN** the function returns an authentication failure and makes no provider
  call

#### Scenario: Invalid token is rejected before quota/provider work

- **WHEN** an AI request includes a bearer token that Supabase Auth rejects
- **THEN** the function returns an authentication failure before consuming
  quota or invoking the model provider

#### Scenario: Authenticated user reaches the provider

- **WHEN** a request has a valid authenticated user, a valid bounded payload,
  and available quota
- **THEN** the function may invoke the provider using server-side credentials
  and returns only the intended structured result

### Requirement: AI abuse control is durable and user-keyed

Each authenticated user MUST be subject to an atomic server-side quota keyed by
user identity and request class. Quota state MUST NOT rely on process-local
memory. A rejected request MUST return HTTP 429 and MUST NOT invoke a provider.

#### Scenario: Request is under quota

- **WHEN** an authenticated user has remaining quota for the request class
- **THEN** the quota is atomically consumed and the request proceeds to normal
  validation/provider handling

#### Scenario: Request exceeds quota

- **WHEN** an authenticated user has exhausted the request-class window
- **THEN** the function returns HTTP 429 with a bounded retry signal and makes
  no upstream model call

#### Scenario: Parallel quota requests race

- **WHEN** parallel requests for the same user would exceed the configured
  quota together
- **THEN** the atomic server-side decision admits no more than the configured
  number in the window

### Requirement: AI requests remain bounded and non-leaking

AI functions MUST enforce request-size limits, provider timeouts, and generic
provider-facing error responses. Provider secrets and internal error details
MUST remain server-side.

#### Scenario: Oversized request is rejected

- **WHEN** the request body exceeds the configured maximum
- **THEN** the function rejects it before model invocation

#### Scenario: Provider times out or fails

- **WHEN** an upstream provider times out or returns an error
- **THEN** the function returns a generic unavailable response without exposing
  API keys, authorization material, or internal stack details
