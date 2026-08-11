import type { CoverageReportOptions } from 'monocart-coverage-reports';

// Frontend e2e coverage is collected from Chromium's V8 coverage API and
// mapped back to the original src/ files through the production source map
// (module.js.map). Enabled when E2E_COVERAGE=true.
export const coverageEnabled = process.env.E2E_COVERAGE === 'true';

export const coverageOptions: CoverageReportOptions = {
  name: 'Factry Historian datasource e2e frontend coverage',
  outputDir: './coverage/e2e-frontend',

  reports: [
    // Human-readable summary in the terminal / CI log.
    ['console-summary'],
    // Browsable HTML report with per-file line coverage.
    ['v8'],
    // Machine-readable outputs for CI summaries and external tooling.
    ['json-summary'],
    ['lcovonly', { file: 'lcov.info' }],
  ],

  // Only the plugin bundle; Grafana's own bundles are not under test.
  entryFilter: (entry) => entry.url.includes('/plugins/factry-historian-datasource/module.js'),

  // Only original plugin sources, not webpack runtime, AMD externals or
  // node_modules. The webpack config sets rootDir to src/, so source paths in
  // the map are relative to it WITHOUT a src/ prefix (e.g. "datasource.ts",
  // "QueryEditor/Assets.tsx").
  sourceFilter: (sourcePath) => /\.(ts|tsx)$/.test(sourcePath) && !sourcePath.includes('node_modules'),
};
