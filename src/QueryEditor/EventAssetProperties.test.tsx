import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'

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
// on the label EventAssetProperties passes down.
jest.mock('components/Cascader/Cascader', () => ({
  __esModule: true,
  default: ({ initialLabel }: { initialLabel: string }) => (
    <input data-testid="override-assets" readOnly value={initialLabel} />
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
  }) as unknown as DataSource

const renderComponent = (overrideAssets: string[]) =>
  render(
    <EventAssetProperties
      datasource={createMockDatasource()}
      seriesLimit={0}
      selectedAssets={[]}
      overrideAssets={overrideAssets}
      selectedAssetProperties={[]}
      queryType="simple"
      queryOptions={{} as any}
      tags={[]}
      appIsAlertingType={false}
      templateVariables={[]}
      onChangeAssetMeasurementQuery={jest.fn()}
      onChangeSeriesLimit={jest.fn()}
    />
  )

describe('EventAssetProperties', () => {
  it('displays a regex override asset instead of clearing it', async () => {
    renderComponent(['/pump.*/'])

    await waitFor(() => {
      expect(screen.getByTestId('override-assets')).toHaveValue('/pump.*/')
    })
  })

  it('displays a template variable override asset', async () => {
    renderComponent(['$myVar'])

    await waitFor(() => {
      expect(screen.getByTestId('override-assets')).toHaveValue('$myVar')
    })
  })
})
