import { test as base } from '@grafana/plugin-e2e';
import MCR from 'monocart-coverage-reports';
import { coverageEnabled, coverageOptions } from './coverage/options';

// Wraps @grafana/plugin-e2e's test with an automatic fixture that collects V8
// JS coverage for every test when E2E_COVERAGE=true. All specs must import
// { test, expect } from this file instead of '@grafana/plugin-e2e'.
export const test = base.extend<{ collectCoverage: void }>({
  collectCoverage: [
    async ({ page, browserName }, use) => {
      const collecting = coverageEnabled && browserName === 'chromium';
      if (collecting) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      }

      await use();

      if (collecting) {
        const coverage = await page.coverage.stopJSCoverage();
        // MCR caches raw data on disk, so parallel workers all add to the
        // same report; the global teardown generates it once.
        await MCR(coverageOptions).add(coverage);
      }
    },
    { auto: true },
  ],
});

export { expect } from '@grafana/plugin-e2e';
