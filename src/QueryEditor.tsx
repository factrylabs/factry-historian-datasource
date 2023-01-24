import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { Assets } from 'QueryEditor/Assets'
import { Measurements } from 'QueryEditor/Measurements'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { DataSource } from './datasource'
import type { CascaderOption } from 'components/Cascader/Cascader'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, RawQuery, Asset, TimeseriesDatabase, Attributes, State } from './types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
    this.onTimeseriesDatabaseChange = this.onTimeseriesDatabaseChange.bind(this)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.onUpdateTags = this.onUpdateTags.bind(this)
    this.onAssetChange = this.onAssetChange.bind(this)
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
    measurementQuery: {
      GroupBy: ['status'],
      Aggregation: {
        Name: 'mean',
      },
    },
    tags: [],
    assetProperties: [],
    assets: [],
    rawQuery: {
      Query: '',
      TimeseriesDatabase: ''
    },
    selectedProperties: []
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
    this.getAssets().then((assets) => {
      this.saveState({ ...this.state, assets: assets })
    })
  }

  setTabIndex(index: number) {
    switch (index) {
      case 0:
      case 1:
        if (this.state.measurementQuery) {
          this.onChangeMeasurementQuery(this.state.measurementQuery)
          this.onRunQuery(this.props)
        }
        break
      case 2:
        if (this.state.rawQuery?.Query) {
          this.onChangeRawQuery(this.state.rawQuery.Query)
          this.onRunQuery(this.props)
        }
        break
    }
    this.saveState({ ...this.state, tabIndex: index })
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
    const filter = { ...this.state.filter, Keyword: query }
    await this.props.datasource.getMeasurements(filter, this.state.pagination).then((measurements) => {
      this.saveState({ ...this.state, measurements: measurements })
      measurements.forEach((measurement) => {
        const database = this.state.databases.find(e => e.UUID === measurement.DatabaseUUID)
        result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
      })
    })
    return result
  }

  async getAssets(): Promise<CascaderOption[]> {
    return this.props.datasource.getAssets().then((assets) => {
      return this.props.datasource.getAssetProperties().then((assetProperties) => {
        this.saveState({ ...this.state, assetProperties: assetProperties })
        return this.getChildAssets(null, assets)
      })
    })
  }

  getChildAssets(parent: string | null, assets: Asset[]): CascaderOption[] {
    const result: CascaderOption[] = []

    assets.filter((asset) => asset.ParentUUID === parent).forEach((asset) => {
      let items = this.getChildAssets(asset.UUID, assets)
      const cascaderOption: CascaderOption = {
        label: asset.Name,
        value: asset.UUID,
        items: items
      }
      result.push(cascaderOption)
    })

    return result
  }

  onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    this.saveState({ ...this.state, filter: { ...this.state.filter, Database: event.value } })
  }

  onAssetChange = (value: string): void => {
    this.saveState({ ...this.state, filter: { ...this.state.filter, Asset: value } })
  }

  onUpdateTags(updatedTags: Attributes): void {
    this.saveState({ ...this.state, tags: updatedTags })
  }

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery, selectedProperties?: Array<SelectableValue<string>>): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    this.saveState({ ...this.state, measurementQuery: measurementQuery, selectedProperties: selectedProperties ? selectedProperties : this.state.selectedProperties })
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
      TimeseriesDatabase: this.state.filter.Database,
      Query: queryString,
    } as RawQuery
    this.saveState({ ...this.state, rawQuery: query.query })
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

    if (props.query.queryType === 'MeasurementQuery') {
      const query = props.query.query as MeasurementQuery
      if (query.Measurements?.length === 0) {
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
            assetProperties={this.state.assetProperties}
            assets={this.state.assets}
            filter={this.state.filter}
            measurementQuery={this.state.measurementQuery}
            tags={this.state.tags}
            selectedProperties={this.state.selectedProperties}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
            onUpdateTags={this.onUpdateTags}
            onAssetChange={this.onAssetChange}
            onRunQuery={() => this.onRunQuery(this.props)}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
          <Measurements
            databases={this.state.databases}
            measurements={this.state.measurements}
            filter={this.state.filter}
            measurementQuery={this.state.measurementQuery}
            tags={this.state.tags}
            onLoadMeasurementOptions={this.loadMeasurementOptions}
            onTimeseriesDatabaseChange={this.onTimeseriesDatabaseChange}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
            onUpdateTags={this.onUpdateTags}
            onRunQuery={() => this.onRunQuery(this.props)}
          />
        ),
      },
      {
        title: 'Raw',
        content: (
          <RawQueryEditor
            databases={this.state.databases}
            filter={this.state.filter}
            query={this.state.rawQuery?.Query}
            onChangeRawQuery={this.onChangeRawQuery}
            onRunQuery={() => this.onRunQuery(this.props)}
            onTimeseriesDatabaseChange={this.onTimeseriesDatabaseChange}
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
