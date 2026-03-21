# audit-performance

Run a full performance and PWA audit of the SuperHabits web app
using Lighthouse and Fetch MCPs. Requires npm run web running
on localhost:8081.

---

BASE_URL = http://localhost:8081

---
OUTPUT FOLDER: .cursor/playwright-output/
Save ALL screenshots and any exported Lighthouse reports to
this folder. Use these filenames:
  audit-perf-mobile.png           (Phase 2 — if screenshot taken)
  audit-perf-desktop.png          (Phase 3 — if screenshot taken)
  audit-pwa.png                   (Phase 4 — if screenshot taken)
  audit-accessibility.png         (Phase 5 — if screenshot taken)
  audit-best-practices-seo.png    (Phase 6 — if screenshot taken)
  lighthouse-report.json          (full JSON report if exported)
Create the folder if it does not exist.
Do not save output to the project root or any other path.
---

## Phase 1 — Header verification (Fetch MCP)

Fetch BASE_URL and inspect response headers.

| Header | Expected value | Actual | Status |
|--------|---------------|--------|--------|
| cross-origin-embedder-policy | require-corp | ? | PASS/FAIL |
| cross-origin-opener-policy | same-origin | ? | PASS/FAIL |

Also check: are any other security-relevant headers present?
(e.g. Content-Security-Policy, X-Frame-Options, Cache-Control)

Document any missing headers that would be recommended for a
production PWA.

## Phase 2 — Lighthouse: Performance (mobile)

Run Lighthouse audit on BASE_URL with:
  categories: ["performance"]
  device: mobile
  throttling: true (simulates 4G + mid-range device)

Report:
- Overall performance score (0–100)
- Core Web Vitals:
  - LCP (Largest Contentful Paint) — target < 2.5s
  - FID / INP (Interaction to Next Paint) — target < 200ms
  - CLS (Cumulative Layout Shift) — target < 0.1
- First Contentful Paint (FCP) — target < 1.8s
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Speed Index

Flag anything outside the "Good" threshold.

## Phase 3 — Lighthouse: Performance (desktop)

Same audit, device: desktop, throttling: false.

Report same metrics. Note delta between mobile and desktop scores.

## Phase 4 — Lighthouse: PWA checklist

Run Lighthouse audit with:
  categories: ["pwa"]
  device: desktop

Report each PWA criterion:
- Is served over HTTPS (or localhost) ✓/✗
- Has a web app manifest ✓/✗
- Has a service worker ✓/✗
- Works offline ✓/✗
- Is installable ✓/✗
- Icons for home screen ✓/✗
- Splash screen configured ✓/✗
- Theme color set ✓/✗

Flag any failures with the recommended fix.

## Phase 5 — Lighthouse: Accessibility

Run Lighthouse audit with:
  categories: ["accessibility"]
  device: desktop

Report:
- Overall accessibility score
- Any failing checks (e.g. missing alt text, contrast issues,
  missing ARIA labels, keyboard navigation gaps)

## Phase 6 — Lighthouse: Best Practices + SEO

Run Lighthouse audit with:
  categories: ["best-practices", "seo"]
  device: desktop

Report scores and any flagged issues.

## Phase 7 — Summary report

| Category | Score | Key issues |
|----------|-------|------------|
| Performance (mobile) | ? | ? |
| Performance (desktop) | ? | ? |
| PWA | ? | ? |
| Accessibility | ? | ? |
| Best Practices | ? | ? |
| SEO | ? | ? |
| COEP header | PASS/FAIL | ? |
| COOP header | PASS/FAIL | ? |

**Priority fixes (if any):**
List the top 3 issues by impact on user experience, with:
- What the issue is
- Which file to change
- Estimated effort (low/medium/high)

**Audit output:** .cursor/playwright-output/
(Folder is in .gitignore — not committed to the repo.
 Lighthouse JSON report saved here if the MCP supports export.)

**Known acceptable issues:**
- localhost is used (some PWA checks require HTTPS — expected in dev)
- expo-notifications warning on web — known Expo limitation
- No ESLint configured — not a Lighthouse concern
- Output screenshots are for local reference only —
  .cursor/playwright-output/ is gitignored
