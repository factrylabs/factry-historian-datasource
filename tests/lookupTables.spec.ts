import { test, expect } from './fixtures'
import { inlineFieldInput } from './utils'

// The mock's "Line settings" table has 250 rows. The provisioned dashboard filters it to
// (line = L1 AND setpoint >= 100) OR (line = L2 AND active = true), 55 rows, and reads
// page $page (2) of 20 rows: setpoints 135 to 196.
test.describe('lookup table query', () => {
  test('provisioned dashboard renders the page a variable picks', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'lookuptables.json' })
    const dashboardPage = await gotoDashboardPage(dashboard)

    const panel = dashboardPage.getPanelByTitle('Line settings')
    await expect(panel.getErrorIcon()).toBeHidden()
    await expect(panel.locator).toContainText('135')
    await expect(panel.locator).toContainText('136')
    // The last row of page 1.
    await expect(panel.locator).not.toContainText('130')
  })

  test('the editor shows the saved grouping and the page a variable picks', async ({
    readProvisionedDashboard,
    gotoPanelEditPage,
    page,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'lookuptables.json' })
    await gotoPanelEditPage({ dashboard, id: '1' })

    await expect(page.getByText('(', { exact: true })).toHaveCount(2)
    await expect(page.getByText(')', { exact: true })).toHaveCount(2)
    await expect(page.getByText('Rows 21 to 40 of 55 (page 2 of 3)')).toBeVisible()
    // The page belongs to the variable, so the buttons do not move it.
    await expect(page.getByRole('button', { name: 'next page' })).toBeDisabled()
  })

  test('a query built in the editor pages through the rows', async ({
    panelEditPage,
    readProvisionedDataSource,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' })
    await panelEditPage.datasource.set(ds.name)

    await page.getByRole('radio', { name: 'Lookup tables' }).check({ force: true })
    await inlineFieldInput(page, 'Lookup table').click()
    await page.getByRole('option', { name: 'Line settings' }).click()

    // A new query starts on a limit of 1000, which holds the whole table.
    await expect(page.getByText('Rows 1 to 250 of 250 (page 1 of 1)')).toBeVisible()

    const limit = inlineFieldInput(page, 'Limit')
    await limit.fill('100')
    await limit.blur()
    await expect(page.getByText('Rows 1 to 100 of 250 (page 1 of 3)')).toBeVisible()

    await page.getByRole('button', { name: 'next page' }).click()
    await expect(page.getByText('Rows 101 to 200 of 250 (page 2 of 3)')).toBeVisible()
  })
})
