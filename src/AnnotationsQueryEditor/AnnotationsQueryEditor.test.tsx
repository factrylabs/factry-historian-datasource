import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AnnotationsQueryEditor } from './AnnotationsQueryEditor'
import { DataSource } from 'datasource'
import { EventQuery, PropertyType, Query, TabIndex } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

jest.mock('QueryEditor/Events', () => ({
  Events: (props: { datasource: DataSource }) => (
    <div data-testid="events-editor">{props.datasource.historianInfo?.Version ?? 'no historian info'}</div>
  ),
}))

const savedQuery: Query = {
  refId: 'A',
  tabIndex: TabIndex.Events,
  seriesLimit: 0,
  queryType: 'EventQuery',
  query: {
    Type: PropertyType.Simple,
    Assets: [],
    PropertyFilter: [],
    QueryAssetProperties: false,
    OverrideAssets: [],
    OverrideTimeRange: false,
    TimeRange: {},
    Ascending: true,
  } as EventQuery,
}

describe('AnnotationsQueryEditor', () => {
  // The Events editor shows version-gated fields such as Match mode, so it must see the
  // historian info once it has loaded.
  it('renders the Events editor again once the historian info has loaded', async () => {
    const datasource = {
      historianInfo: undefined,
      getInfo: jest.fn(async function (this: DataSource) {
        this.historianInfo = { Version: 'v8.4.0' } as DataSource['historianInfo']
      }),
    } as unknown as DataSource

    render(
      <AnnotationsQueryEditor datasource={datasource} query={savedQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />
    )

    expect(await screen.findByText('v8.4.0')).toBeInTheDocument()
  })

  describe('a new annotation', () => {
    const renderNew = async (version: string) => {
      const datasource = {
        historianInfo: undefined,
        getInfo: jest.fn(async function (this: DataSource) {
          this.historianInfo = { Version: version } as DataSource['historianInfo']
        }),
      } as unknown as DataSource
      const onChange = jest.fn()
      render(
        <AnnotationsQueryEditor
          datasource={datasource}
          query={{ refId: 'A' } as Query}
          onChange={onChange}
          onRunQuery={jest.fn()}
        />
      )
      await waitFor(() => expect(onChange).toHaveBeenCalled())
      return onChange.mock.calls[onChange.mock.calls.length - 1][0].query as EventQuery
    }

    it('defaults to overlapping on a historian with match modes', async () => {
      expect((await renderNew('v8.4.0')).MatchMode).toBe('overlapping')
    })

    it('leaves the match mode unset on a historian without match modes', async () => {
      expect((await renderNew('v8.3.0')).MatchMode).toBeUndefined()
    })
  })
})
