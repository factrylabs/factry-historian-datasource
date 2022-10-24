import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { AsyncSelect, Cascader, RadioButtonGroup, Select, InlineField, InlineFieldRow, CascaderOption, CodeEditor } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { DataSource } from './datasource'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter, RawQuery, AssetProperty, Measurement, Asset, Pagination, TimeseriesDatabase } from './types'

interface State {
  tabIndex: number
  databases: Array<TimeseriesDatabase>
  filter: MeasurementFilter
  pagination: Pagination
  measurements: Array<Measurement>
  assetProperties: Array<AssetProperty>
  assets: Array<CascaderOption>
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
  }

  state = {
    tabIndex: 0,
    filter: {
      Database: '',
    },
    pagination: {
      Limit: 100,
    },
    databases: [],
    measurements: [],
  } as State

  componentDidMount() {
    // TODO somehow fill in selected value on reload
    // TODO better way to determine tab to open
    let tabIndex = 0
    const { query } = this.props
    switch (query.queryType) {
      case 'MeasurementQuery':
        tabIndex = 0
        if (query.query.Measurements.length > 0 && !query.query.Measurements[0].Name) {
          tabIndex = 1
        }
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

  getTimeseriesDatabases(): Array<TimeseriesDatabase> {
    const result: Array<TimeseriesDatabase> = []
    this.props.datasource.getTimeseriesDatabases().then((timeseriesDatabases) => {
      timeseriesDatabases.forEach((timeseriesDatabase) => {
        if (timeseriesDatabase.Name !== '_internal_factry') {
          result.push(timeseriesDatabase)
        }
      })
    })

    return result
  }

  selectableTimeseriesDatabases(databases: Array<TimeseriesDatabase>): Array<SelectableValue<string>> {
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
      query.query = {
        Measurements: [this.state.measurements.find((m) => m.UUID === event.value)],
        GroupBy: ['status']
      } as MeasurementQuery
      onChange(query)
    }
  }

  getAssets(): Array<CascaderOption> {
    const result: Array<CascaderOption> = []
    this.props.datasource.getAssets().then((assets) => {
      this.props.datasource.getAssetProperties().then((assetProperties) => {
        this.setState({ ...this.state, assetProperties: assetProperties })
        result.push(...this.getChildAssets(null, assets))
      })
    })

    return result
  }

  getChildAssets(parent: string, assets: Asset[]): Array<CascaderOption> {
    const result: Array<CascaderOption> = []

    assets.filter((asset) => asset.ParentUUID === parent).forEach((asset) => {
      const cascaderOption: CascaderOption = {
        label: asset.Name,
        value: asset.UUID,
        items: this.getChildAssets(asset.UUID, assets)
      }
      const properties = this.state.assetProperties
        ?.filter(assetProperty => assetProperty.AssetUUID === asset.UUID)
        .map(assetProperty => {
          return {
            label: assetProperty.Name,
            value: assetProperty.UUID,
          } as CascaderOption
        })

      cascaderOption.items.push(...properties)
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
        Measurements: [{ UUID: assetProperty.MeasurementUUID }], // TODO fetch measurement somewhere, that way we have all engineering values
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
    const { query } = this.props;
    const tabs = [
      {
        title: 'Measurements',
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
            <InlineFieldRow>
              <InlineField label="Measurement" grow labelWidth={20} tooltip="Specify measurement to work with">
                <AsyncSelect
                  placeholder="select measurement"
                  loadOptions={this.loadMeasurementOptions}
                  defaultOptions
                  onChange={this.onMeasurementChange}
                  menuShouldPortal
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
            {this.state.filter.Database !== '' &&
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
