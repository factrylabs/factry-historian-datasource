import { test, expect } from './fixtures';
import { inlineFieldInput } from './utils';

// Cross-cutting smoke test: the query editor exposes all four query types and
// switching tabs swaps in the matching editor surface. Deeper per-type flows
// live in the *Query.spec.ts files.
test.describe('query editor navigation', () => {
  test('exposes the four query-type tabs and switches editors', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);

    for (const tab of ['Assets', 'Measurements', 'Events', 'Raw']) {
      await expect(page.getByRole('radio', { name: tab })).toBeVisible();
    }

    // Assets is the default tab: asset cascader + properties select.
    await expect(page.getByText('Properties', { exact: true })).toBeVisible();

    await page.getByRole('radio', { name: 'Measurements' }).check({ force: true });
    await expect(page.getByText('select measurement')).toBeVisible();
    await expect(page.getByText('Use regular expression')).toBeVisible();

    await page.getByRole('radio', { name: 'Events' }).check({ force: true });
    await expect(page.getByText('Event query', { exact: true })).toBeVisible();
    await expect(page.getByText('Query Type', { exact: true })).toBeVisible();

    await page.getByRole('radio', { name: 'Raw' }).check({ force: true });
    // The database select renders without a matchable placeholder text node on
    // some Grafana versions, so assert on the labelled combobox input instead.
    await expect(inlineFieldInput(page, 'Database')).toBeVisible();
  });
});
