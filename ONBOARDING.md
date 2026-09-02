# Fresh-machine onboarding

This is the canonical bootstrap entry point for a new workstation or a fresh coding-agent environment. Complete this document before implementation work. The objective is a reproducible machine that can build, test, inspect, and operate this repository without rediscovering tooling mid-campaign.

## 1. Preflight rule

1. Clone the repository and enter its root.
2. Confirm the intended repository/branch and fetch current `origin/main`.
3. Read the repository control-plane documents before changing code: `AGENTS.md`, `CLAUDE.md`, `README.md`, `.agent/`, active OpenSpec/exec-plan state.
4. Install/verify the machine prerequisites below.
5. Enable the committed agent integrations and repository-local skills.
6. Restore dependencies from lockfiles/pins; do not casually upgrade them during bootstrap.
7. Run the baseline validation commands.
8. Only then begin a development campaign. If a prerequisite cannot be satisfied, record it as an environment blocker rather than weakening a gate.

Credentials, API keys, signing material, account logins, licensed assets, and other secrets are machine/user responsibilities. Never commit them.

## 2. Supported host and prerequisites

**Primary host:** Windows/Linux/macOS authoring; Android is a primary native test target and iOS requires macOS/Xcode.

**Required machine tools**

- Git
- Node.js >=22.22.1 <23
- npm >=10.9 <11
- Expo/React Native dependencies from `package-lock.json`
- Android Studio/SDK + ADB + compatible JDK for Android work
- Playwright Chromium for web/E2E

**Task-dependent / optional tools**

- Maestro for native journeys (`.maestro/`)
- Supabase CLI for schema/backend tasks
- macOS/Xcode for iOS
- Lighthouse for PWA/performance checks

## 3. Agent setup

- Load repository instructions before acting. Prefer committed repository state over chat history.
- Repository-local skills: `goal`, `db-and-sync-invariants`, `feature-module-pattern`, `rn-expo-conventions`, and the committed OpenSpec skills.
- Discover and use committed agent adapter/config directories in-place; do not duplicate them globally unless the harness cannot load repository-local configuration.
- Relevant committed agent surfaces: `.agent/`, `.agents/`, `.claude/`, `.codex/`, `.cursor/`, `.kimi*/`, `.opencode/`, `.maestro/`.
- MCP policy: Use committed `.mcp.json`: Playwright, Context7, GitHub, Fetch, Lighthouse, and Mobile Next MCP. Keep secrets in environment/provider auth only; use Mobile MCP for emulator/device automation instead of host mouse/keyboard control.
- Keep diagnostic/documentation MCPs narrow. An MCP does not grant architecture, publishing, production, or gate-bypass authority.
- Authenticate GitHub and coding-agent CLIs separately on the machine. Never store tokens in tracked files.

## 4. Bootstrap

```bash
npm ci
npx playwright install chromium
npm run dev:doctor
npm run doctor
```

The repo contains `.nvmrc`; honor it. Supabase is optional for local-first app work but required for tasks that explicitly touch backup/schema integration.

## 5. Editor/LSP baseline

Use the local TypeScript 5.9 service, ESLint, Expo/React Native types, and NativeWind awareness. Do not let a global TypeScript version override the repo pin.

The editor is optional; reliable language diagnostics are not.

## 6. Baseline verification

```bash
npm run qa:fast
npm run qa:integration
npm run openspec:validate
npm run qa:impact:validate
npm run build:web
npm run web:verify    # finite live-web verification; must exit by itself and free its port
npm run e2e:journeys:p0
```

A fresh machine is **development-ready** when all applicable non-external gates pass. Hardware/device/signing/account gates may remain explicitly blocked when repository state already classifies them that way.

## 7. Fresh-agent instruction

> Read `ONBOARDING.md` first. Set up every applicable prerequisite, repository-local skill, MCP/plugin, dependency, browser/device/runtime tool, and validation gate described there. Then read the repository's durable agent state and only start implementation after preflight is green or a genuine environment blocker is recorded. Do not replace pinned tooling, skip gates, or invent work to compensate for a missing machine capability.
