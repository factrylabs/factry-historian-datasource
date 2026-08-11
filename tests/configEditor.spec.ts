import { test, expect } from './fixtures';

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

  test('an unreachable historian fails the health check', async ({ createDataSourceConfigPage, page }) => {
    const configPage = await createDataSourceConfigPage({ type: PLUGIN_ID });

    // Port 9999 is not bound in the mock container: the backend health check
    // must surface an error instead of a false positive.
    await page.getByPlaceholder('http://127.0.0.1:8000').fill('http://mockhistorian:9999');
    await page.locator('input[name="organization"]').fill('00000000-0000-0000-0000-000000000000');
    await page.getByPlaceholder('token').fill('e2e-mock-token');

    await expect(configPage.saveAndTest()).not.toBeOK();
  });
});
