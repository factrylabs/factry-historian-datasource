import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { EventFilter } from './EventFilter'
import { DataSource } from 'datasource'
import { EventQuery } from 'types'

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
  Select: () => null,
  MultiSelect: () => null,
}))

// Cascader test double: surface initialLabel as an input value so we can assert
// on the label EventFilter passes down.
jest.mock('components/Cascader/Cascader', () => ({
  __esModule: true,
  default: ({ initialLabel }: { initialLabel: string }) => (
    <input data-testid="assets" readOnly value={initialLabel} />
  ),
}))

jest.mock('components/TagsSection/TagsSection', () => ({
  TagsSection: () => null,
}))

const createMockDatasource = () =>
  ({
    getAssets: jest.fn().mockResolvedValue([]),
    getEventTypes: jest.fn().mockResolvedValue([]),
    getEventTypeProperties: jest.fn().mockResolvedValue([]),
    getEventConfigurations: jest.fn().mockResolvedValue([]),
    multiSelectReplace: (value: string) => [value],
    containsTemplate: () => false,
    historianInfo: { Version: '' },
  }) as unknown as DataSource

const renderComponent = (assets: string[]) => {
  const query: EventQuery = {
    Assets: assets,
    EventTypes: [],
    Properties: [],
    Statuses: [],
    PropertyFilter: [],
  } as unknown as EventQuery

  return render(<EventFilter query={query} datasource={createMockDatasource()} onChangeQuery={jest.fn()} />)
}

describe('EventFilter', () => {
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
