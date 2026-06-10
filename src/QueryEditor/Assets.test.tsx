import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { Assets } from './Assets'
import { DataSource } from 'datasource'
import { AssetMeasurementQuery } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

jest.mock('@grafana/ui', () => ({
  InlineField: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Cascader test double: surface initialLabel as an input value so we can assert
// on the label Assets passes down.
jest.mock('components/Cascader/Cascader', () => ({
  __esModule: true,
  default: ({ initialLabel }: { initialLabel: string }) => (
    <input data-testid="assets" readOnly value={initialLabel} />
  ),
}))

jest.mock('components/util/AssetPropertiesSelect', () => ({
  AssetProperties: () => null,
}))

jest.mock('./QueryOptions', () => ({
  QueryOptions: () => null,
}))

const createMockDatasource = () =>
  ({
    getAssets: jest.fn().mockResolvedValue([]),
    getAssetProperties: jest.fn().mockResolvedValue([]),
    multiSelectReplace: (value: string) => [value],
  }) as unknown as DataSource

const renderComponent = (assets: string[]) => {
  const query: AssetMeasurementQuery = {
    Assets: assets,
    AssetProperties: [],
    Options: { Tags: {} } as any,
  } as AssetMeasurementQuery

  return render(
    <Assets
      query={query}
      seriesLimit={0}
      datasource={createMockDatasource()}
      appIsAlertingType={false}
      templateVariables={[]}
      onChangeAssetMeasurementQuery={jest.fn()}
      onChangeSeriesLimit={jest.fn()}
    />
  )
}

describe('Assets', () => {
  it('displays a regex asset instead of clearing it', async () => {
    renderComponent(['/pump.*/'])

    await waitFor(() => {
      expect(screen.getByTestId('assets')).toHaveValue('/pump.*/')
    })
  })

  it('displays a template variable asset', async () => {
    renderComponent(['$myVar'])

    await waitFor(() => {
      expect(screen.getByTestId('assets')).toHaveValue('$myVar')
    })
  })
})
