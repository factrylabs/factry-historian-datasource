import { test, expect } from './fixtures';
import { enableTableView, inlineFieldInput } from './utils';

test.describe('measurements query', () => {
  test('provisioned dashboard renders data from the mock Historian', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'measurements.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // The panel runs a MeasurementQuery end-to-end: frontend -> Go backend ->
    // mock (/api/measurements + /api/timeseries/query). Success = a rendered
    // panel with no error and no "No data" message.
    const panel = dashboardPage.getPanelByTitle('Motor speed');
    await expect(panel.getErrorIcon()).toBeHidden();
    // The value column ("e2e.motor.speed") only renders when the query returns
    // a frame. Asserting on rendered text (rather than panel.data, which pins a
    // table-cell role that changed across Grafana versions) keeps this robust
    // across the Grafana version matrix.
    await expect(panel.locator).toContainText('e2e.motor.speed');
  });

  test('a measurement picked in the query editor returns data', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);
    await enableTableView(page);

    await page.getByRole('radio', { name: 'Measurements' }).check({ force: true });
    await expect(page.getByText('select measurement')).toBeVisible();
    // The measurement select remounts once the database list resolves
    // (key={selectedDatabases}), which would destroy the input mid-typing.
    await page.waitForTimeout(1500);

    // Type into the combobox input; the options load from the mock's
    // /api/measurements with the typed keyword.
    await inlineFieldInput(page, 'Measurements').pressSequentially('temperature', { delay: 40 });
    await page.getByRole('option', { name: /e2e\.motor\.temperature/ }).click();

    // Selecting a measurement triggers the query; the rendered table proves the
    // full frontend -> backend -> mock -> Arrow decode path.
    await expect(panelEditPage.refreshPanel()).toBeOK();
    await expect(panelEditPage.panel.locator).toContainText('e2e.motor.temperature');
  });

  test('regex mode queries all matching measurements', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);
    await enableTableView(page);

    await page.getByRole('radio', { name: 'Measurements' }).check({ force: true });
    await page.getByText('Use regular expression').click();

    await page.getByPlaceholder('[m|M]otor_[0-9]').fill('e2e\\.motor\\..*');

    // The regex input debounces for 500ms before it updates the query.
    await expect(panelEditPage.refreshPanel()).toBeOK();
    await expect(panelEditPage.panel.locator).toContainText('e2e.motor.speed');
  });
});
