import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { AsyncSelect, Cascader, RadioButtonGroup, Select, InlineField, InlineFieldRow, CascaderOption, CodeEditor, Input } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { DataSource } from './datasource'
import { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter, RawQuery, AssetProperty, Measurement, Asset, Pagination, TimeseriesDatabase, AggregationName, Aggregation, Attributes } from './types'
import { InfluxQueryTag, TagsSection } from 'TagsSection'

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

function selectable(store: Array<SelectableValue<string>>, value?: string): SelectableValue<string> {
  if (value === undefined) {
    return {}
  }

  return store.filter((e) => e.value === value)
}

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
    this.onSelectAsset = this.onSelectAsset.bind(this)
    this.onTimeseriesDatabaseChange = this.onTimeseriesDatabaseChange.bind(this)
    this.setRawQuery = this.setRawQuery.bind(this)
    this.getTimeseriesDatabaseType = this.getTimeseriesDatabaseType.bind(this)
    this.onAggregationChange = this.onAggregationChange.bind(this)
    this.onGroupByChange = this.onGroupByChange.bind(this)
    this.handleTagsSectionChange = this.handleTagsSectionChange.bind(this)
    this.onPeriodChange = this.onPeriodChange.bind(this)
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

  selectableTimeseriesDatabases(databases: TimeseriesDatabase[]): Array<SelectableValue<string>> {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
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

  onMeasurementChange = (event: SelectableValue<string>) => {
    if (event.value) {
      const { onChange, query } = this.props
      query.queryType = 'MeasurementQuery'
      const measurements = [event.value]
      const measurementQuery = { ...this.state.measurementQuery, Measurements: measurements }
      this.setState({ ...this.state, measurementQuery: measurementQuery })
      query.query = measurementQuery
      onChange(query)
    }
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
      const properties = this.state.assetProperties
        ?.filter(assetProperty => assetProperty.AssetUUID === asset.UUID)
        .map(assetProperty => {
          return {
            label: assetProperty.Name,
            value: assetProperty.UUID,
          } as CascaderOption
        })

      items.push(...properties)
      const cascaderOption: CascaderOption = {
        label: asset.Name,
        value: asset.UUID,
        items: items
      }
      result.push(cascaderOption)
    })

    return result
  }

  onSelectAsset(selected: string) {
    const assetProperty = this.state.assetProperties.find(e => e.UUID === selected)
    if (assetProperty) {
      const { onChange, query } = this.props
      query.queryType = 'MeasurementQuery'
      query.query = {
        Measurements: [assetProperty.MeasurementUUID],
        GroupBy: ['status']
      } as MeasurementQuery
      onChange(query)
    }
  }

  setRawQuery(queryString: string) {
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

  getTimeseriesDatabaseType(database: string): string {
    return this.state.databases.find(e => e.UUID === database)?.TimeseriesDatabaseType?.Name || 'Unknown database type'
  }

  getAggregations(): Array<SelectableValue<string>> {
    return Object.values(AggregationName)
      .filter((aggregation) => isNaN(Number(aggregation)))
      .map((aggregation) => {
        return {
          label: aggregation,
          value: aggregation,
        } as SelectableValue<string>
      })
  }

  onAggregationChange(event: SelectableValue<string>): void {
    if (event.value) {
      const { onChange, query } = this.props
      query.queryType = 'MeasurementQuery'
      const aggregation = {
        ...this.state.measurementQuery.Aggregation,
        Name: event.value,
      } as Aggregation
      const measurementQuery = { ...this.state.measurementQuery, Aggregation: aggregation }
      this.setState({ ...this.state, measurementQuery: measurementQuery })
      query.query = measurementQuery
      onChange(query)
    }
  }

  onGroupByChange(event: React.ChangeEvent<HTMLInputElement>): void {
    if (event.target.value) {
      const { onChange, query } = this.props
      query.queryType = 'MeasurementQuery'
      const groupBy = event.target.value.split(',').map(groupBy => groupBy.trim())
      const measurementQuery = { ...this.state.measurementQuery, GroupBy: groupBy }
      this.setState({ ...this.state, measurementQuery: measurementQuery })
      query.query = measurementQuery
      onChange(query)
    }
  }

  handleTagsSectionChange(updatedTags: InfluxQueryTag[]): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    const tags: Attributes = {}
    updatedTags.forEach(tag => {
      tags[tag.key] = tag.value
    })
    const measurementQuery = { ...this.state.measurementQuery, Tags: tags }
    this.setState({ ...this.state, tags: updatedTags, measurementQuery: measurementQuery })
    query.query = measurementQuery
    onChange(query)
  }

  getIntervals(): Array<SelectableValue<string>> {
    return [
      {
        label: "$__interval", value: "$__interval"
      },
      {
        label: "1s", value: "1s"
      },
      {
        label: "10s", value: "10s"
      },
      {
        label: "1m", value: "1m"
      },
      {
        label: "5m", value: "5m"
      },
      {
        label: "10m", value: "10m"
      },
      {
        label: "15m", value: "15m"
      },
      {
        label: "1h", value: "1h"
      }
    ]
  }

  onPeriodChange(selected: SelectableValue<string>): void {
    if (selected.value) {
      const { onChange, query } = this.props
      query.queryType = 'MeasurementQuery'
      const aggregation = {
        ...this.state.measurementQuery.Aggregation,
        Period: selected.value
      } as Aggregation
      const measurementQuery = { ...this.state.measurementQuery, Aggregation: aggregation }
      this.setState({ ...this.state, measurementQuery: measurementQuery })
      query.query = measurementQuery
      onChange(query)
    }
  }

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode
      }>
  ) {
    if (props.query.queryType) {
      this.props.onRunQuery()
    }
  }

  render() {
    const tabs = [
      {
        title: 'Measurements',
        content: (
          <div>
            <InlineFieldRow>
              <InlineField label="Database" labelWidth={20} tooltip="Specify a time series database to work with">
                <Select
                  value={selectable(this.selectableTimeseriesDatabases(this.state.databases), this.state.filter.Database)}
                  placeholder="select timeseries database"
                  options={this.selectableTimeseriesDatabases(this.state.databases)}
                  onChange={this.onTimeseriesDatabaseChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with">
                <AsyncSelect
                  placeholder="select measurement"
                  loadOptions={this.loadMeasurementOptions}
                  defaultOptions
                  onChange={this.onMeasurementChange}
                  menuShouldPortal

                />
              </InlineField>
              <InlineField>
                <Select
                  defaultValue={this.state.measurementQuery.Aggregation?.Name}
                  placeholder="select an aggregation"
                  options={this.getAggregations()}
                  onChange={this.onAggregationChange}
                />
              </InlineField>
              <TagsSection
                tags={this.state.tags}
                onChange={this.handleTagsSectionChange}
                getTagKeyOptions={() => { return Promise.resolve([]) }}
                getTagValueOptions={(key: string) => { return Promise.resolve([]) }}
              />
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="GROUP BY" labelWidth={20} tooltip="Enter a list of tags to group by separated by ','">
                <Input
                  placeholder="group by"
                  onChange={this.onGroupByChange}
                  defaultValue="status"
                />
              </InlineField>
              <InlineField>
                <Select
                  value={this.state.measurementQuery.Aggregation?.Period || "$__interval"}
                  options={this.getIntervals()}
                  onChange={this.onPeriodChange} // TODO allow custom options
                />
              </InlineField>
            </InlineFieldRow>
          </div>
        ),
      },
      {
        title: 'Assets',
        content: (
          <InlineFieldRow>
            <InlineField label="Asset" grow labelWidth={20} tooltip="Specify an asset property to work with">
              <Cascader
                options={this.state.assets}
                displayAllSelectedLevels
                onSelect={this.onSelectAsset}
              />
            </InlineField>
          </InlineFieldRow>
        ),
      },
      {
        title: 'Raw',
        content: (
          <div>
            <InlineFieldRow>
              <InlineField label="Database" grow labelWidth={20} tooltip="Specify a time series database to work with">
                <Select
                  value={selectable(this.selectableTimeseriesDatabases(this.state.databases), this.state.filter.Database)}
                  placeholder="select timeseries database"
                  options={this.selectableTimeseriesDatabases(this.state.databases)}
                  onChange={this.onTimeseriesDatabaseChange}
                />
              </InlineField>
            </InlineFieldRow>
            {this.state.filter.Database &&
              <InlineFieldRow>
                <InlineField label={`${this.getTimeseriesDatabaseType(this.state.filter.Database)} query`} grow labelWidth={20} tooltip="">
                  <CodeEditor
                    height={'200px'}
                    language="sql"
                    onBlur={this.setRawQuery}
                    onSave={this.setRawQuery}
                    showMiniMap={false}
                    showLineNumbers={true}
                    readOnly={this.state.filter.Database === ''}
                    value=""
                  />
                </InlineField>
              </InlineFieldRow>
            }
          </div>
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
