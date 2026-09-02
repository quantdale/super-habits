const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const viewports = [
  { name: 'phone-360', width: 360, height: 800 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-412', width: 412, height: 915 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const sections = [
  { id: 'overview', name: 'Today' },
  { id: 'todos', name: 'Todos' },
  { id: 'habits', name: 'Habits' },
  { id: 'pomodoro', name: 'Focus' },
  { id: 'workout', name: 'Workout' },
  { id: 'calories', name: 'Calories' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to the app
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });

  // Create output directory
  const outputDir = path.join(__dirname, '..', 'docs', 'ui-ux', 'baseline-screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const section of sections) {
      // Click the section tab
      // Note: The actual selector might need adjustment based on the UI
      try {
        await page.click(`text=${section.name}`);
        await page.waitForTimeout(500); // Wait for animation/rendering

        // Take screenshot
        const filename = `${viewport.name}-${section.id}.png`;
        await page.screenshot({
          path: path.join(outputDir, filename),
          fullPage: false
        });
        console.log(`Captured: ${filename}`);
      } catch (e) {
        console.error(`Failed to capture ${section.name} at ${viewport.name}:`, e.message);
      }
    }
  }

  await browser.close();
  console.log('Baseline capture complete.');
})();
