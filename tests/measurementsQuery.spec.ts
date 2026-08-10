import { test, expect } from '@grafana/plugin-e2e';

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

  test('query editor exposes the four query-type tabs', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);

    for (const tab of ['Assets', 'Measurements', 'Events', 'Raw']) {
      await expect(page.getByRole('radio', { name: tab })).toBeVisible();
    }
  });
});
