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

// AssetProperties test double: list the property options Assets offers.
jest.mock('components/util/AssetPropertiesSelect', () => ({
  AssetProperties: ({ assetProperties }: { assetProperties: Array<{ UUID: string; Name: string }> }) => (
    <ul data-testid="properties">
      {assetProperties.map((p) => (
        <li key={p.UUID}>{p.Name}</li>
      ))}
    </ul>
  ),
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

const renderComponent = (assets: string[], datasource: DataSource = createMockDatasource()) => {
  const query: AssetMeasurementQuery = {
    Assets: assets,
    AssetProperties: [],
    Options: { Tags: {} } as any,
  } as AssetMeasurementQuery

  return render(
    <Assets
      query={query}
      seriesLimit={0}
      datasource={datasource}
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

  it('offers the properties of every asset a saved multi-level regex matches', async () => {
    const tank1 = { UUID: 'a1', Name: 'Tank', AssetPath: 'Site\\Line 1\\Tank' }
    const tank2 = { UUID: 'a2', Name: 'Tank', AssetPath: 'Site\\Line 2\\Tank' }
    const datasource = {
      ...createMockDatasource(),
      historianInfo: { Version: 'v8.2.0' },
      // The historian matches a regex Path against the asset path.
      getAssets: jest.fn(async (filter?: { Path?: string }) => (filter?.Path ? [tank1, tank2] : [])),
      getAssetProperties: jest.fn(async (filter?: { AssetUUIDs?: string[] }) =>
        filter?.AssetUUIDs?.includes('a1') && filter.AssetUUIDs.includes('a2')
          ? [
              { UUID: 'p1', Name: 'Level', AssetUUID: 'a1' },
              { UUID: 'p2', Name: 'Temperature', AssetUUID: 'a2' },
            ]
          : []
      ),
    } as unknown as DataSource
    renderComponent(['/Site\\\\Line.*\\\\Tank/'], datasource)

    await waitFor(() => {
      expect(screen.getByTestId('properties')).toHaveTextContent('Level')
    })
    expect(screen.getByTestId('properties')).toHaveTextContent('Temperature')
  })
})
