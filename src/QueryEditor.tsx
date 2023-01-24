import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { Assets } from 'QueryEditor/Assets'
import { Measurements } from 'QueryEditor/Measurements'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { DataSource } from './datasource'
import type { CascaderOption } from 'components/Cascader/Cascader'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter, RawQuery, AssetProperty, Measurement, Asset, Pagination, TimeseriesDatabase, Attributes } from './types'

interface State {
  tabIndex: number
  databases: TimeseriesDatabase[]
  filter: MeasurementFilter
  pagination: Pagination
  measurements: Measurement[]
  assetProperties: AssetProperty[]
  assets: CascaderOption[]
  measurementQuery: MeasurementQuery
  rawQuery: RawQuery
  tags: any
}

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
    this.onTimeseriesDatabaseChange = this.onTimeseriesDatabaseChange.bind(this)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.onUpdateTags = this.onUpdateTags.bind(this)
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
  } as State

  componentDidMount() {
    // TODO somehow fill in selected value on reload
    // TODO better way to determine tab to open
    let tabIndex = 0
    const { query } = this.props
    switch (query.queryType) {
      case 'MeasurementQuery':
        tabIndex = 0
        break
      case 'RawQuery':
        tabIndex = 2
        break
    }
    const databases = this.getTimeseriesDatabases()
    const assets = this.getAssets()

    this.setState({ ...this.state, databases: databases, assets: assets, tabIndex: tabIndex })
  }

  setTabIndex(index: number) {
    this.setState({ ...this.state, tabIndex: index })
  }

  getTimeseriesDatabases(): TimeseriesDatabase[] {
    const result: TimeseriesDatabase[] = []
    this.props.datasource.getTimeseriesDatabases().then((timeseriesDatabases) => {
      timeseriesDatabases.forEach((timeseriesDatabase) => {
        if (timeseriesDatabase.Name !== '_internal_factry') {
          result.push(timeseriesDatabase)
        }
      })
    })

    return result
  }

  onTimeseriesDatabaseChange = (event: SelectableValue<string>) => {
    this.setState({ ...this.state, filter: { ...this.state.filter, Database: event.value } })
  }

  async loadMeasurementOptions(query: string): Promise<Array<SelectableValue<string>>> {
    const result: Array<SelectableValue<string>> = []
    const filter = { ...this.state.filter, Keyword: query }
    await this.props.datasource.getMeasurements(filter, this.state.pagination).then((measurements) => {
      this.setState({ ...this.state, measurements: measurements })
      measurements.forEach((measurement) => {
        const database = this.state.databases.find(e => e.UUID === measurement.DatabaseUUID)
        result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
      })
    })
    return result
  }

  getAssets(): CascaderOption[] {
    const result: CascaderOption[] = []
    this.props.datasource.getAssets().then((assets) => {
      this.props.datasource.getAssetProperties().then((assetProperties) => {
        this.setState({ ...this.state, assetProperties: assetProperties })
        result.push(...this.getChildAssets(null, assets))
      })
    })

    return result
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

  onUpdateTags(updatedTags: Attributes): void {
    this.setState({ ...this.state, tags: updatedTags })
  }

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    this.setState({ ...this.state, measurementQuery: measurementQuery })
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
    onChange(query)
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
            query={this.props.query}
            measurementQuery={this.state.measurementQuery}
            tags={this.state.tags}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
            onUpdateTags={this.onUpdateTags}
            onRunQuery={() => this.onRunQuery(this.props)}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
          <Measurements
            databases={this.state.databases}
            filter={this.state.filter}
            measurementQuery={this.state.measurementQuery}
            query={this.props.query}
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
