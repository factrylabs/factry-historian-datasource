import { dirname } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import type { PluginOptions } from '@grafana/plugin-e2e';

// Directory of the plugin-e2e auth setup (logs into Grafana and stores the
// session), resolved from the installed package.
const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

export default defineConfig<PluginOptions>({
  testDir: './tests',
  // Only pick up the TypeScript specs; the Go mock server lives under tests/ too.
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  // V8 coverage collection roughly doubles page load time, which pushes a first
  // panel render past the 5s default and makes the provisioned-dashboard specs
  // flake. Panels are the slowest thing asserted on, so raise it suite-wide.
  expect: { timeout: 15_000 },
  // Frontend coverage collection (no-ops unless E2E_COVERAGE=true).
  globalSetup: require.resolve('./tests/coverage/global-setup'),
  globalTeardown: require.resolve('./tests/coverage/global-teardown'),
  use: {
    // This repo's docker-compose publishes Grafana on host port 3001 (-> 3000).
    baseURL: process.env.GRAFANA_URL ?? 'http://localhost:3001',
    // The e2e provisioning (mock datasource + dashboard) lives here, separate
    // from the dev provisioning in ./provisioning.
    provisioningRootDir: 'tests/provisioning',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'auth',
      testDir: pluginE2eAuth,
      testMatch: [/.*\.js/],
    },
    {
      name: 'run',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['auth'],
    },
  ],
});
