# E2E Tests

Playwright E2E tests for the SuperHabits web app.

## Runtime Model

- E2E runs against the static web export in `dist/`.
- `playwright.config.ts` starts `node scripts/serve-e2e.js` on `http://localhost:8081`.
- Metro (`npm run web`) is for development only and is not the E2E target.

## Before Running

When the web bundle has changed:

```bash
npm run build:web
```

Then run:

- `npm run e2e`
- `npm run e2e:report`
- `npm run e2e:headed`
- `npm run e2e:debug`

## Important Constraints

- Local Playwright workers stay at `1` because OPFS-backed SQLite holds an origin lock.
- `e2e/global.setup.ts` requires `crossOriginIsolated`.
- Tests rely on static headers that mirror deployment requirements.

## Output

- HTML report: `.cursor/playwright-output/e2e-report/`
- Failures and traces: `.cursor/playwright-output/e2e-failures/`
