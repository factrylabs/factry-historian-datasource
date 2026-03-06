import React from 'react'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { QueryEditor } from './QueryEditor'
import { DataSource } from './datasource'
import { Query, TabIndex } from './types'
import { dateTime } from '@grafana/data'

// Mock @grafana/runtime before importing QueryEditor
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

// Mock heavy sub-editors to isolate QueryEditor rendering logic
jest.mock('QueryEditor/Assets', () => ({
  Assets: () => <div data-testid="assets-editor">Assets</div>,
}))
jest.mock('QueryEditor/Measurements', () => ({
  Measurements: () => <div data-testid="measurements-editor">Measurements</div>,
}))
jest.mock('QueryEditor/Events', () => ({
  Events: () => <div data-testid="events-editor">Events</div>,
}))
jest.mock('QueryEditor/RawQueryEditor', () => ({
  RawQueryEditor: () => <div data-testid="raw-query-editor">Raw</div>,
}))

const mockDatasource = {
  getInfo: jest.fn().mockResolvedValue({}),
  defaultTab: TabIndex.Measurements,
  historianInfo: undefined,
} as unknown as DataSource

function makeQuery(overrides: Partial<Query> = {}): Query {
  return {
    refId: 'A',
    tabIndex: TabIndex.Measurements,
    seriesLimit: 0,
    query: {} as any,
    queryType: 'MeasurementQuery',
    ...overrides,
  }
}

const defaultProps = {
  datasource: mockDatasource,
  query: makeQuery(),
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  range: {
    from: dateTime('2024-01-01'),
    to: dateTime('2024-01-02'),
    raw: { from: 'now-1d', to: 'now' },
  },
}

describe('QueryEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the tab buttons', async () => {
    render(<QueryEditor {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Assets')).toBeInTheDocument()
      expect(screen.getByText('Measurements')).toBeInTheDocument()
      expect(screen.getByText('Events')).toBeInTheDocument()
      expect(screen.getByText('Raw')).toBeInTheDocument()
    })
  })

  it('calls datasource.getInfo on mount', async () => {
    render(<QueryEditor {...defaultProps} />)

    await waitFor(() => {
      expect(mockDatasource.getInfo).toHaveBeenCalledTimes(1)
    })
  })

  it('renders Measurements editor when queryType is MeasurementQuery', async () => {
    const query = makeQuery({ queryType: 'MeasurementQuery', tabIndex: TabIndex.Measurements })
    render(<QueryEditor {...defaultProps} query={query} />)

    await waitFor(() => {
      expect(screen.getByTestId('measurements-editor')).toBeInTheDocument()
    })
  })

  it('renders Assets editor when queryType is AssetMeasurementQuery', async () => {
    const query = makeQuery({ queryType: 'AssetMeasurementQuery', tabIndex: TabIndex.Assets })
    render(<QueryEditor {...defaultProps} query={query} />)

    await waitFor(() => {
      expect(screen.getByTestId('assets-editor')).toBeInTheDocument()
    })
  })

  it('renders Events editor when queryType is EventQuery', async () => {
    const query = makeQuery({ queryType: 'EventQuery', tabIndex: TabIndex.Events })
    render(<QueryEditor {...defaultProps} query={query} />)

    await waitFor(() => {
      expect(screen.getByTestId('events-editor')).toBeInTheDocument()
    })
  })

  it('renders Raw editor when queryType is RawQuery', async () => {
    const query = makeQuery({ queryType: 'RawQuery', tabIndex: TabIndex.RawQuery })
    render(<QueryEditor {...defaultProps} query={query} />)

    await waitFor(() => {
      expect(screen.getByTestId('raw-query-editor')).toBeInTheDocument()
    })
  })

  it('calls onChange when tab is switched', async () => {
    const onChange = jest.fn()
    const query = makeQuery({ queryType: 'MeasurementQuery', tabIndex: TabIndex.Measurements })
    render(<QueryEditor {...defaultProps} query={query} onChange={onChange} />)

    // Wait for mount to finish
    await waitFor(() => {
      expect(screen.getByTestId('measurements-editor')).toBeInTheDocument()
    })

    // Click the "Assets" tab button
    await act(async () => {
      fireEvent.click(screen.getByText('Assets'))
    })

    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.queryType).toBe('AssetMeasurementQuery')
    expect(lastCall.tabIndex).toBe(TabIndex.Assets)
  })

  it('does not show sub-editor content before mount finishes', () => {
    // Before componentDidMount resolves, mountFinished is false
    render(<QueryEditor {...defaultProps} />)

    // Sub-editors should NOT be present yet (mountFinished=false)
    expect(screen.queryByTestId('measurements-editor')).not.toBeInTheDocument()
  })
})
