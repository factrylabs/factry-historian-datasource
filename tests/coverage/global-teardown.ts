import MCR from 'monocart-coverage-reports';
import { coverageEnabled, coverageOptions } from './options';

// Generates the frontend coverage report (console summary + HTML + lcov +
// json-summary) from the data every test added via tests/fixtures.ts.
export default async function globalTeardown(): Promise<void> {
  if (!coverageEnabled) {
    return;
  }
  await MCR(coverageOptions).generate();
}
