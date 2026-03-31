import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { RawQueryEditor } from './RawQueryEditor'
import { DataSource } from 'datasource'
import { RawQuery } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

// Mock @grafana/ui — only provide what RawQueryEditor actually uses
jest.mock('@grafana/ui', () => ({
  CodeEditor: ({ value, onBlur }: { value: string; onBlur: (v: string) => void }) => (
    <textarea data-testid="code-editor" defaultValue={value} onBlur={(e) => onBlur(e.target.value)} />
  ),
  InlineField: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: ({ options, onChange }: { options: Array<{ label: string; value: string }>; onChange: (v: any) => void }) => (
    <select onChange={(e) => onChange({ value: e.target.value })}>
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

const mockDatabases = [
  { UUID: 'db-1', Name: 'InfluxDB', Description: 'Main DB', TimeseriesDatabaseType: { Name: 'InfluxDB' } },
  { UUID: 'db-2', Name: 'PostgreSQL', Description: 'Second DB', TimeseriesDatabaseType: { Name: 'PostgreSQL' } },
]

const createMockDatasource = (databases = mockDatabases) =>
  ({
    getTimeseriesDatabases: jest.fn().mockResolvedValue(databases),
  }) as unknown as DataSource

const defaultQuery: RawQuery = {
  TimeseriesDatabase: '',
  Query: '',
}

describe('RawQueryEditor', () => {
  it('renders nothing while loading', () => {
    const datasource = createMockDatasource()
    render(<RawQueryEditor datasource={datasource} query={defaultQuery} onChangeRawQuery={jest.fn()} />)
    // The component renders an empty fragment until loading finishes
    expect(screen.queryByText('Database')).not.toBeInTheDocument()
  })

  it('shows database selector after data loads', async () => {
    const datasource = createMockDatasource()
    render(<RawQueryEditor datasource={datasource} query={defaultQuery} onChangeRawQuery={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument()
    })
  })

  it('fetches databases from the datasource on mount', async () => {
    const datasource = createMockDatasource()
    render(<RawQueryEditor datasource={datasource} query={defaultQuery} onChangeRawQuery={jest.fn()} />)

    await waitFor(() => {
      expect(datasource.getTimeseriesDatabases).toHaveBeenCalledTimes(1)
    })
  })

  it('does not show CodeEditor when no database is selected', async () => {
    const datasource = createMockDatasource()
    render(<RawQueryEditor datasource={datasource} query={defaultQuery} onChangeRawQuery={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
  })

  it('shows CodeEditor when a database is selected', async () => {
    const datasource = createMockDatasource()
    const queryWithDb: RawQuery = { TimeseriesDatabase: 'db-1', Query: 'SELECT *' }
    render(<RawQueryEditor datasource={datasource} query={queryWithDb} onChangeRawQuery={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    })
  })

  it('renders the database label after loading', async () => {
    const datasource = createMockDatasource()
    render(<RawQueryEditor datasource={datasource} query={defaultQuery} onChangeRawQuery={jest.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument()
    })
  })
})
