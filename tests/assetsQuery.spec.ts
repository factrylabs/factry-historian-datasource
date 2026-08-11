import { test, expect } from './fixtures';
import { enableTableView, inlineFieldInput, selectCascaderPath } from './utils';

test.describe('assets query', () => {
  test('provisioned dashboard renders asset property data', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'assets.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // AssetMeasurementQuery end-to-end: the backend resolves the Motor asset
    // (UUIDs[i] filter), fetches its properties, queries both measurements and
    // renames the frames to "<asset path>\\<property>". The table panel only
    // renders the first frame (alphabetically Speed); the multi-frame naming
    // is covered by the backend integration test in tests/mockhistorian.
    const panel = dashboardPage.getPanelByTitle('Motor properties');
    await expect(panel.getErrorIcon()).toBeHidden();
    await expect(panel.locator).toContainText('Motor');
    await expect(panel.locator).toContainText('Speed');
  });

  test('an asset property picked through the cascader returns data', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await panelEditPage.datasource.set(ds.name);
    await enableTableView(page);

    // Assets is the default tab. Walk the lazy-loading cascader down to an
    // asset property leaf; each level is fetched from the mock on demand.
    await selectCascaderPath(page, inlineFieldInput(page, 'Assets'), ['Site', 'Line 1', 'Motor', 'Speed']);

    await expect(panelEditPage.refreshPanel()).toBeOK();
    await expect(panelEditPage.panel.locator).toContainText('Speed');
  });
});
