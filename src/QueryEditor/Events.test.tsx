import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Events } from './Events'
import { DataSource } from 'datasource'
import { EventQuery, PropertyType } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

jest.mock('./EventFilter', () => ({ EventFilter: () => null }))
jest.mock('./EventAssetProperties', () => ({ EventAssetProperties: () => null }))

const datasourceOn = (version: string) => ({ historianInfo: { Version: version } } as unknown as DataSource)

const savedQuery: EventQuery = {
  Type: PropertyType.Simple,
  Assets: [],
  PropertyFilter: [],
  QueryAssetProperties: false,
  OverrideAssets: [],
  OverrideTimeRange: false,
  TimeRange: {},
  Ascending: false,
}

const renderEvents = (query: EventQuery, version = 'v8.4.0', onChangeEventQuery = jest.fn()) =>
  render(
    <Events
      query={query}
      seriesLimit={0}
      datasource={datasourceOn(version)}
      onChangeEventQuery={onChangeEventQuery}
      onChangeSeriesLimit={jest.fn()}
    />
  )

describe('Events match mode', () => {
  // A saved query without a mode gets the historian's legacy filter, which is Contained.
  it('shows Contained for a saved query without a mode', () => {
    renderEvents(savedQuery)

    expect(screen.getByLabelText('Contained')).toBeChecked()
  })

  it('shows the mode of the query', () => {
    renderEvents({ ...savedQuery, MatchMode: 'overlapping' })

    expect(screen.getByLabelText('Overlapping')).toBeChecked()
  })

  it('sets the selected mode on the query', () => {
    const onChangeEventQuery = jest.fn()
    renderEvents(savedQuery, 'v8.4.0', onChangeEventQuery)

    fireEvent.click(screen.getByLabelText('Ends in range'))

    expect(onChangeEventQuery).toHaveBeenCalledWith({ ...savedQuery, MatchMode: 'ends_in_range' })
  })

  it('is hidden on a historian without match modes', () => {
    renderEvents(savedQuery, 'v8.3.0')

    expect(screen.queryByLabelText('Contained')).not.toBeInTheDocument()
  })
})
