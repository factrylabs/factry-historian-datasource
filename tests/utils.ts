import type { Locator, Page } from '@playwright/test';

// Grafana's InlineField renders `<div><label>…</label><child/></div>`, so the
// first input inside the label's next sibling is the field's control. This is
// stable across Grafana versions and avoids page-wide nth() indexes.
export function inlineFieldInput(page: Page, label: string): Locator {
  return page.locator(`label:has-text("${label}") + div input`).first();
}

// Renders the query result as a table in the panel editor. Uses the editor's
// "Table view" toggle instead of panelEditPage.setVisualization('Table'):
// Grafana >= 12.4 changed the visualization picker markup that plugin-e2e
// 1.19 targets, while the toggle is stable across the version matrix.
export async function enableTableView(page: Page): Promise<void> {
  await page.getByTestId('data-testid toggle-table-view').check({ force: true });
}

// Escapes a literal for use inside a RegExp. Asset and property names are data,
// not patterns, so they must not be interpreted as one.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Walks the lazy-loading asset cascader one menu level at a time. Each click
// triggers a child fetch from the mock (ParentUUIDs filter); Playwright
// auto-waits for the next level to appear.
//
// Matching is strict on purpose: anchored on the full label so "Line 1" cannot
// select "Line 10", and scoped to the column belonging to this depth so a name
// that also exists in an ancestor level cannot be picked instead. rc-cascader
// renders one ul.rc-cascader-menu per open level, left to right. The 📦/📏
// prefix on option labels is the only part callers do not spell out.
export async function selectCascaderPath(page: Page, input: Locator, path: string[]): Promise<void> {
  await input.click();
  for (const [depth, segment] of path.entries()) {
    const label = new RegExp(`^(?:📦 |📏 )?${escapeRegExp(segment)}$`);
    const column = page.locator('.rc-cascader-menu').nth(depth);
    await column.locator('.rc-cascader-menu-item').filter({ hasText: label }).click();
  }
  // The dropdown's open state follows the input's focus, so it stays open
  // after selecting and would intercept clicks on the next field. Blur it.
  await page.keyboard.press('Tab');
  await page.locator('.rc-cascader-menu-item').first().waitFor({ state: 'hidden' });
}
