import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { Assets } from 'QueryEditor/Assets'
import { Measurements } from 'QueryEditor/Measurements'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { DataSource } from './datasource'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, RawQuery, TimeseriesDatabase, State } from './types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.saveState = this.saveState.bind(this)
  }

  state = {
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
        },
        filter: {
          Database: '',
        },
        tags: [],
      },
      selectedProperties: []
    },
    measurementsState: {
      queryOptions: {
        measurementQuery: {
          GroupBy: ['status'],
          Aggregation: {
            Name: 'mean',
          },
        },
        filter: {
          Database: '',
        },
        tags: [],
      },
      selectedMeasurement: {},
    },
    rawState: {
      rawQuery: {
        Query: '',
        TimeseriesDatabase: ''
      },
      filter: {
        Database: '',
      },
    }
  } as State

  UNSAFE_componentWillMount() {
    const { query } = this.props
    if (query.state) {
      this.saveState({ ...query.state })
    }
  }

  componentDidMount(): void {
    this.getTimeSeriesDatabases().then((databases) => {
      this.saveState({ ...this.state, databases: databases })
    })
    this.getAssets()
  }

  setTabIndex(index: number) {
    this.saveState({ ...this.state, tabIndex: index })

    switch (index) {
      case 0:
        if (this.state.assetsState.queryOptions.measurementQuery) {
          this.onChangeMeasurementQuery(this.state.assetsState.queryOptions.measurementQuery)
          this.onRunQuery(this.props)
        }
        break
      case 1:
        if (this.state.measurementsState.queryOptions.measurementQuery) {
          this.onChangeMeasurementQuery(this.state.measurementsState.queryOptions.measurementQuery)
          this.onRunQuery(this.props)
        }
        break
      case 2:
        if (this.state.rawState.rawQuery?.Query) {
          this.onChangeRawQuery(this.state.rawState.rawQuery.Query)
          this.onRunQuery(this.props)
        }
        break
    }
  }

  async getTimeSeriesDatabases(): Promise<TimeseriesDatabase[]> {
    return this.props.datasource.getTimeseriesDatabases().then((timeSeriesDatabases) => {
      const result: TimeseriesDatabase[] = []
      timeSeriesDatabases.forEach((timeSeriesDatabase) => {
        if (timeSeriesDatabase.Name !== '_internal_factry') {
          result.push(timeSeriesDatabase)
        }
      })
      return result
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

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    query.query = measurementQuery
    onChange(query)
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
  }

  saveState(state: State): void {
    const { onChange, query } = this.props
    query.state = state
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
            onRunQuery={() => this.onRunQuery(this.props)}
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
            onRunQuery={() => this.onRunQuery(this.props)}
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
            onRunQuery={() => this.onRunQuery(this.props)}
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
        {tabs[this.state.tabIndex].content}
      </div>
    )
  }
}
