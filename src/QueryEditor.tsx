import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { Assets } from 'QueryEditor/Assets'
import { Measurements } from 'QueryEditor/Measurements'
import { Events } from 'QueryEditor/Events'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { getSelectedAssetProperties, propertyFilterToQueryTags, tagsToQueryTags } from 'QueryEditor/util'
import { DataSource } from './datasource'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, RawQuery, QueryEditorState, MeasurementQueryState, EventQuery } from './types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends PureComponent<Props, QueryEditorState> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.onChangeEventQuery = this.onChangeEventQuery.bind(this)
    this.saveState = this.saveState.bind(this)
  }

  state = {
    loading: true,
    tabIndex: 0,
    filter: {
      Database: '',
    },
    pagination: {
      Limit: 100,
      Page: 1,
    },
    databases: [],
    measurements: [],
    assetProperties: [],
    assets: [],
    assetsState: {
      queryOptions: {
        measurementQuery: {
          GroupBy: ['status'],
          Aggregation: {
            Name: 'mean',
          },
          IncludeLastKnownPoint: false,
          UseEngineeringSpecs: true
        },
        filter: {
          Database: '',
        },
        tags: [],
      },
      selectedAsset: '',
      selectedProperties: []
    },
    measurementsState: {
      queryOptions: {
        measurementQuery: {
          GroupBy: ['status'],
          Aggregation: {
            Name: 'mean',
          },
          IncludeLastKnownPoint: false,
          UseEngineeringSpecs: true
        },
        filter: {
          Database: '',
        },
        tags: [],
      },
      selectedMeasurement: '',
    },
    eventsState: {
      eventQuery: {
        PropertyFilter: []
      },
      tags: [],
    },
    rawState: {
      rawQuery: {
        Query: '',
        TimeseriesDatabase: '',
      },
      filter: {
        Database: '',
      },
    },
    eventTypes: [],
    eventTypeProperties: [],
    eventConfigurations: [],
    selectedEventTypes: []
  } as QueryEditorState

  componentDidMount(): void {
    const { query } = this.props
    this.saveState({
      ...this.state,
      tabIndex: query.tabIndex,
      measurementsState: {
        ...this.state.measurementsState,
        selectedMeasurement: query.selectedMeasurement
      },
      assetsState: {
        ...this.state.assetsState,
        selectedAsset: query.tabIndex === 0 ? query.selectedAssetPath : undefined
      },
      eventsState: {
        ...this.state.eventsState,
        selectedAsset: query.tabIndex === 2 ? query.selectedAssetPath : undefined
      }
    })

    this.loadDataForTab(query).then(() => {
      if (!query.query) {
        this.saveState({
          ...this.state,
          loading: false,
          tabIndex: 0
        })
        return
      }
      switch (query.tabIndex) {
        case 0: { // assets
          const measurementQuery = query.query as MeasurementQuery
          const queryOptions: MeasurementQueryState = {
            tags: tagsToQueryTags(measurementQuery.Tags),
            filter: {
              Database: ''
            },
            measurementQuery: measurementQuery
          }
          this.saveState({
            ...this.state,
            loading: false,
            tabIndex: query.tabIndex,
            assetsState: {
              ...this.state.assetsState,
              queryOptions: queryOptions,
              selectedAsset: query.selectedAssetPath,
              selectedProperties: getSelectedAssetProperties(measurementQuery.Measurements, this.state.assetProperties)
            }
          })
          break
        }
        case 1: { // measurements
          const measurementQuery = query.query as MeasurementQuery
          const queryOptions: MeasurementQueryState = {
            tags: tagsToQueryTags(measurementQuery.Tags),
            filter: {
              Database: ''
            },
            measurementQuery: measurementQuery
          }
          this.saveState({
            ...this.state,
            loading: false,
            tabIndex: query.tabIndex,
            measurementsState: {
              ...this.state.measurementsState,
              queryOptions: queryOptions,
              selectedMeasurement: query.selectedMeasurement,
            }
          })
          break
        }
        case 2: // events
          const eventQuery = query.query as EventQuery
          this.saveState({
            ...this.state,
            loading: false,
            tabIndex: query.tabIndex,
            eventsState: {
              ...this.state.eventsState,
              eventQuery: eventQuery,
              tags: propertyFilterToQueryTags(eventQuery.PropertyFilter),
              selectedAsset: query.selectedAssetPath,
              selectedEventTypes: eventQuery.EventTypes ? eventQuery.EventTypes.map(e => { return { label: this.state.eventTypes.find(et => et.UUID === e)?.Name, value: e } }) : undefined
            }
          })
          break
        case 3: // raw query
          const rawQuery = query.query as RawQuery
          this.saveState({
            ...this.state,
            loading: false,
            tabIndex: query.tabIndex,
            rawState: {
              ...this.state.rawState,
              filter: {
                Database: rawQuery.TimeseriesDatabase
              },
              rawQuery: rawQuery
            }
          })
          break
      }
    })
  }

  loadDataForTab(query: Query): Promise<void> {
    let promises = []
    switch (query.tabIndex || 0) {
      case 0:
        promises.push(this.getAssets())
        break
      case 1:
        promises.push(this.getTimeSeriesDatabases())
        promises.push(this.loadMeasurementOptions(query.selectedMeasurement || ''))
        break
      case 2:
        promises.push(this.getAssets())
        promises.push(this.getEventTypes())
        promises.push(this.getEventTypeProperties())
        promises.push(this.getEventConfigurations())
        break
      case 3:
        promises.push(this.getTimeSeriesDatabases())
        break
    }

    return Promise.all(promises).then()
  }

  setTabIndex(index: number): void {
    this.saveState({ ...this.state, tabIndex: index })
    const { query } = this.props
    this.loadDataForTab(query)
    switch (index) {
      case 0:
        if (this.state.assetsState.queryOptions.measurementQuery) {
          this.onChangeMeasurementQuery(this.state.assetsState.queryOptions.measurementQuery)
        }
        break
      case 1:
        if (this.state.measurementsState.queryOptions.measurementQuery) {
          this.onChangeMeasurementQuery(this.state.measurementsState.queryOptions.measurementQuery)
        }
        break
      case 3:
        if (this.state.rawState.rawQuery?.Query) {
          this.onChangeRawQuery(this.state.rawState.rawQuery.Query)
        }
        break
    }
  }

  async getTimeSeriesDatabases(): Promise<void> {
    await this.props.datasource.getTimeseriesDatabases().then((timeSeriesDatabases) => {
      this.saveState({ ...this.state, databases: timeSeriesDatabases })
    })
  }

  async loadMeasurementOptions(query: string): Promise<Array<SelectableValue<string>>> {
    const result: Array<SelectableValue<string>> = []
    const filter = { ...this.state.measurementsState.queryOptions.filter, Keyword: query }
    await this.props.datasource.getMeasurements(filter, this.state.pagination).then((measurements) => {
      this.saveState({ ...this.state, measurements: measurements })
      measurements.forEach((measurement) => {
        const database = this.state.databases.find(e => e.UUID === measurement.DatabaseUUID)
        result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
      })
    })
    return result
  }

  async getAssets(): Promise<void> {
    await this.props.datasource.getAssets().then((assets) => {
      return this.props.datasource.getAssetProperties().then((assetProperties) => {
        this.saveState({ ...this.state, assetProperties: assetProperties, assets: assets })
      })
    })
  }

  async getEventTypes(): Promise<void> {
    this.props.datasource.getEventTypes().then((eventTypes) => {
      this.saveState({ ...this.state, eventTypes: eventTypes })
    })
  }

  async getEventTypeProperties(): Promise<void> {
    this.props.datasource.getEventTypeProperties().then((eventTypeProperties) => {
      this.saveState({ ...this.state, eventTypeProperties: eventTypeProperties })
    })
  }

  async getEventConfigurations(): Promise<void> {
    this.props.datasource.getEventConfigurations().then((eventConfigurations) => {
      this.saveState({ ...this.state, eventConfigurations: eventConfigurations })
    })
  }

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    query.query = measurementQuery
    onChange(query)
    this.onRunQuery(this.props)
  }

  onChangeRawQuery(queryString: string): void {
    const { onChange, query } = this.props
    query.queryType = 'RawQuery'
    if (getTemplateSrv().getVariables().length > 0) {
      queryString = getTemplateSrv().replace(queryString)
    }
    query.query = {
      TimeseriesDatabase: this.state.rawState.filter.Database,
      Query: queryString,
    } as RawQuery
    this.saveState({
      ...this.state,
      rawState: {
        ...this.state.rawState,
        rawQuery: query.query,
      }
    })
    onChange(query)
    this.onRunQuery(this.props)
  }

  onChangeEventQuery(eventQuery: EventQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'EventQuery'
    query.query = eventQuery
    onChange(query)
    this.onRunQuery(this.props)
  }

  saveState(state: QueryEditorState): void {
    const { onChange, query } = this.props
    query.tabIndex = state.tabIndex
    query.selectedMeasurement = state.measurementsState.selectedMeasurement
    switch (state.tabIndex) {
      case 0:
        query.selectedAssetPath = state.assetsState.selectedAsset
        break
      case 2:
        query.selectedAssetPath = state.eventsState.selectedAsset
        break
    }
    onChange(query)
    this.setState(state)
  }

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode
      }>
  ) {
    if (!props.query.queryType) {
      return
    }

    if (props.query.queryType === 'MeasurementQuery') {
      const query = props.query.query as MeasurementQuery
      if (!query?.Measurements) {
        return
      }
    }

    if (props.query.queryType === 'EventQuery') {
      const query = props.query.query as EventQuery
      if (!query?.EventTypes || !query?.Assets) {
        return
      }
    }
    this.props.onRunQuery()
  }

  render() {
    const tabs = [
      {
        title: 'Assets',
        content: (
          <Assets
            state={this.state}
            saveState={this.saveState}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
          <Measurements
            state={this.state}
            saveState={this.saveState}
            onLoadMeasurementOptions={this.loadMeasurementOptions}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
          />
        ),
      },
      {
        title: 'Events',
        content: (
          <Events
            state={this.state}
            saveState={this.saveState}
            onChangeEventQuery={this.onChangeEventQuery}
          />
        ),
      },
      {
        title: 'Raw',
        content: (
          <RawQueryEditor
            state={this.state}
            saveState={this.saveState}
            onChangeRawQuery={this.onChangeRawQuery}
          />
        )
      }
    ]

    return (
      <div>
        <InlineFieldRow>
          <InlineField>
            <RadioButtonGroup
              onChange={(e) => this.setTabIndex(e ?? 0)}
              value={this.state.tabIndex}
              options={tabs.map((tab, idx) => ({ label: tab.title, value: idx }))}
            />
          </InlineField>
        </InlineFieldRow>
        {!this.state.loading && tabs[this.state.tabIndex].content}
      </div>
    )
  }
}
