import { execFileSync } from 'node:child_process';
import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { installDbHarness } from './helpers/dbHarness';

const MAX_EVENTS = 80;

type DiagnosticEvent = {
  type: 'console' | 'pageerror' | 'response' | 'requestfailed';
  message?: string;
  url?: string;
  method?: string;
  status?: number;
};

type BrowserMetadata = {
  timezone: string;
  userAgent: string;
};

function appendBounded(events: DiagnosticEvent[], event: DiagnosticEvent): void {
  if (events.length >= MAX_EVENTS) return;
  events.push(event);
}

function currentCommit(): string | null {
  try {
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return commit || null;
  } catch {
    return null;
  }
}

async function readBrowserMetadata(page: Page): Promise<BrowserMetadata> {
  return page
    .evaluate(() => ({
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
      userAgent: navigator.userAgent,
    }))
    .catch(() => ({ timezone: process.env.TZ ?? 'unknown', userAgent: 'unavailable' }));
}

/**
 * Playwright test fixture for the standard E2E projects.
 *
 * The simulation runner has its own richer report/repro path. This fixture
 * covers the hand-written feature and journey tests, attaching only bounded
 * failure evidence so a failure is diagnosable without making successful runs
 * noisy or expensive.
 */
export const test = base.extend({
  page: async ({ page }, runFixture, testInfo) => {
    // Install the same-origin harness before the app can register/control its
    // service worker. Reset helpers reuse this route later, but early
    // registration removes a lifecycle race in repeated per-test contexts.
    await installDbHarness(page);

    const events: DiagnosticEvent[] = [];
    const onConsole = (message: import('@playwright/test').ConsoleMessage) => {
      if (message.type() !== 'error' && message.type() !== 'warning') return;
      appendBounded(events, { type: 'console', message: `[${message.type()}] ${message.text()}` });
    };
    const onPageError = (error: Error) => {
      appendBounded(events, { type: 'pageerror', message: error.stack ?? error.message });
    };
    const onResponse = (response: import('@playwright/test').Response) => {
      if (response.status() < 400) return;
      appendBounded(events, {
        type: 'response',
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
      });
    };
    const onRequestFailed = (request: import('@playwright/test').Request) => {
      appendBounded(events, {
        type: 'requestfailed',
        url: request.url(),
        method: request.method(),
        message: request.failure()?.errorText ?? 'request failed',
      });
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);

    try {
      await runFixture(page);
    } finally {
      const unexpected = testInfo.status !== testInfo.expectedStatus;
      if (unexpected) {
        const browser = await readBrowserMetadata(page);
        const diagnostics = {
          schemaVersion: 1,
          capturedAt: new Date().toISOString(),
          test: {
            id: testInfo.testId,
            title: testInfo.titlePath.join(' › '),
            project: testInfo.project.name,
            status: testInfo.status,
            expectedStatus: testInfo.expectedStatus,
            retry: testInfo.retry,
            location: {
              file: testInfo.file,
              line: testInfo.line,
              column: testInfo.column,
            },
          },
          environment: {
            commit: currentCommit(),
            ci: process.env.CI === 'true',
            baseUrl: testInfo.project.use.baseURL ?? null,
            timezone: browser.timezone,
            viewport: page.viewportSize(),
            userAgent: browser.userAgent,
          },
          events,
          replay: 'Run the same Playwright project and test title before changing assertions.',
        };

        try {
          await testInfo.attach('qa-diagnostics.json', {
            body: JSON.stringify(diagnostics, null, 2),
            contentType: 'application/json',
          });
        } catch {
          // Preserve the original test failure if the browser already closed.
        }
        try {
          await testInfo.attach('qa-failure-screenshot.png', {
            body: await page.screenshot({ animations: 'disabled' }),
            contentType: 'image/png',
          });
        } catch {
          // Playwright's built-in screenshot/trace policy remains the fallback.
        }
      }
    }

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
    page.off('requestfailed', onRequestFailed);
  },
});

export { expect };
export type { BrowserContext, Page } from '@playwright/test';
