import { test, expect } from './fixtures';
import { enableTableView, inlineFieldInput, selectCascaderPath } from './utils';

test.describe('events query', () => {
  test('provisioned dashboard renders batch events as a table', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'events.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // EventQuery end-to-end: the backend resolves asset + event type, fetches
    // events (GET /api/events) and event type properties, and converts them to
    // a table frame with one column per simple property. Assert on the fixed
    // event UUIDs (first column): the property columns often sit outside the
    // virtualized table viewport and would not be rendered as text.
    const panel = dashboardPage.getPanelByTitle('Batch events');
    await expect(panel.getErrorIcon()).toBeHidden();
    await expect(panel.locator).toContainText('Batch');
    await expect(panel.locator).toContainText('12121212-1212-1212-1212-121212121212');
    await expect(panel.locator).toContainText('13131313-1313-1313-1313-131313131313');
    // The open event (no stop time) must render too.
    await expect(panel.locator).toContainText('14141414-1414-1414-1414-141414141414');
  });

  test('an event query built in the editor returns events', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);
    await enableTableView(page);

    await page.getByRole('radio', { name: 'Events' }).check({ force: true });

    // Select the Motor asset through the lazy-loading cascader.
    await selectCascaderPath(page, inlineFieldInput(page, 'Assets'), ['Site', 'Line 1', 'Motor']);

    // Event types are filtered by the event configurations of the selected
    // asset; the mock links Batch to the Motor asset.
    await inlineFieldInput(page, 'Event types').click();
    await page.getByRole('option', { name: 'Batch' }).click();

    await expect(panelEditPage.refreshPanel()).toBeOK();
    // The panel renders event data differently per Grafana version: as a table
    // (leading EventUUID column visible) or as a timeseries legend with the
    // numeric property series. Accept either; both prove the event query
    // returned the batch events, while "No data" or an error match neither.
    await expect(panelEditPage.panel.locator).toContainText(
      /13131313-1313-1313-1313-131313131313|yield/
    );
  });
});
