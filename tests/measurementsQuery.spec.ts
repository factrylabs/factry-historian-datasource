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

    // The measurement select remounts whenever the number of selected databases
    // changes (key={props.selectedDatabases?.length}), which would destroy the
    // input mid-typing. Picking a database is the deterministic wait for that:
    // the option can only render after the database list resolved (the same
    // promise sets selectedDatabases before returning the options), and the
    // click is then the last remount before we type.
    await inlineFieldInput(page, 'Database').pressSequentially('historian', { delay: 40 });
    await page.getByRole('option', { name: 'historian' }).click();
    await page.keyboard.press('Tab');

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

    // The regex input debounces for 500ms before it commits to the query, so
    // wait for the run that debounce triggers rather than racing it: calling
    // refreshPanel() straight after fill() asserts a query with no Regex set,
    // and only passes because the debounced run lands while toContainText is
    // still polling. JSON.stringify gives the exact quoted form the regex takes
    // in the request body.
    const regex = 'e2e\\.motor\\..*';
    const debouncedRun = page.waitForRequest(
      (request) =>
        request.method() === 'POST' &&
        request.url().includes('/api/ds/query') &&
        (request.postData() ?? '').includes(JSON.stringify(regex))
    );
    await page.getByPlaceholder('[m|M]otor_[0-9]').fill(regex);
    await debouncedRun;

    await expect(panelEditPage.refreshPanel()).toBeOK();
    await expect(panelEditPage.panel.locator).toContainText('e2e.motor.speed');
  });
});
