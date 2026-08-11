import { test, expect } from './fixtures';
import { inlineFieldInput } from './utils';

test.describe('raw query', () => {
  test('provisioned dashboard renders raw query rows', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'raw.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // RawQuery end-to-end: the backend substitutes $timeFilter, POSTs to
    // /api/timeseries/{db}/raw-query and decodes the Arrow response.
    const panel = dashboardPage.getPanelByTitle('Raw rows');
    await expect(panel.getErrorIcon()).toBeHidden();
    await expect(panel.locator).toContainText('raw-row-1');
    await expect(panel.locator).toContainText('raw-row-3');
  });

  test('selecting a database reveals the query editor', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);

    await page.getByRole('radio', { name: 'Raw' }).check({ force: true });

    // The database select loads from the mock's /api/timeseries-databases.
    // Click the combobox input; the placeholder text is not rendered as a
    // matchable text node on every Grafana version.
    await inlineFieldInput(page, 'Database').click();
    await page.getByRole('option', { name: /historian/ }).click();

    // The code editor only renders once a database is selected, labelled with
    // the database type from the mock fixture (QuestDB).
    await expect(page.getByText('QuestDB query')).toBeVisible();
  });
});
