import { test, expect } from './fixtures';

// The custom variable editor drives the datasource's resource endpoints; each
// query type must produce selectable options from the mock fixtures.
test.describe('template variables', () => {
  test('measurement variable lists measurements with their database', async ({
    variableEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await variableEditPage.datasource.set(ds.name);

    await page.getByLabel('Query type').click();
    await page.getByRole('option', { name: 'Measurement', exact: true }).click();

    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews([/e2e\.motor\.speed - historian/, /e2e\.motor\.temperature - historian/]);
  });

  test('database variable lists timeseries databases', async ({
    variableEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await variableEditPage.datasource.set(ds.name);

    await page.getByLabel('Query type').click();
    await page.getByRole('option', { name: 'Database', exact: true }).click();

    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews(['historian']);
  });

  test('asset variable lists the asset tree', async ({
    variableEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await variableEditPage.datasource.set(ds.name);

    await page.getByLabel('Query type').click();
    await page.getByRole('option', { name: 'Asset', exact: true }).click();

    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews(['Site', 'Line 1', 'Motor']);
  });

  test('event type variable lists event types', async ({
    variableEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await variableEditPage.datasource.set(ds.name);

    await page.getByLabel('Query type').click();
    await page.getByRole('option', { name: 'Event type', exact: true }).click();

    await variableEditPage.runQuery();
    await expect(variableEditPage).toDisplayPreviews(['Batch']);
  });
});
