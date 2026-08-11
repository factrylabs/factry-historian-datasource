import { test, expect } from './fixtures';
import { inlineFieldInput, selectCascaderPath } from './utils';

// Annotations reuse the Events editor restricted to the "simple" property
// type; the annotation query itself runs the same EventQuery backend path.
test.describe('annotations', () => {
  test('annotation editor builds an event query that returns events', async ({
    annotationEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    await annotationEditPage.datasource.set(ds.name);

    await expect(page.getByText('Event query', { exact: true })).toBeVisible();

    // Select the Motor asset through the cascader, then the Batch event type.
    await selectCascaderPath(page, inlineFieldInput(page, 'Assets'), ['Site', 'Line 1', 'Motor']);
    await inlineFieldInput(page, 'Event types').click();
    await page.getByRole('option', { name: 'Batch' }).click();

    await expect(annotationEditPage.runQuery()).toBeOK();
  });
});
