import MCR from 'monocart-coverage-reports';
import { coverageEnabled, coverageOptions } from './options';

// Clears cached coverage data from previous runs so every `pnpm e2e:coverage`
// starts from a clean slate.
export default function globalSetup(): void {
  if (!coverageEnabled) {
    return;
  }
  MCR(coverageOptions).cleanCache();
}
