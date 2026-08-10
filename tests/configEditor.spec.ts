import { test, expect } from '@grafana/plugin-e2e';

const PLUGIN_ID = 'factry-historian-datasource';

test.describe('config editor', () => {
  test('a valid config passes the health check against the mock Historian', async ({
    createDataSourceConfigPage,
    page,
  }) => {
    const configPage = await createDataSourceConfigPage({ type: PLUGIN_ID });

    await page.getByPlaceholder('http://127.0.0.1:8000').fill('http://mockhistorian:8000');
    await page.locator('input[name="organization"]').fill('00000000-0000-0000-0000-000000000000');
    await page.getByPlaceholder('token').fill('e2e-mock-token');

    // Save & test triggers the backend CheckHealth -> GET /api/timeseries-databases
    // on the mock, which returns one database.
    await expect(configPage.saveAndTest()).toBeOK();
  });
});
