import React, { PureComponent } from 'react'
import { getTemplateSrv } from '@grafana/runtime'
import { AsyncSelect, Cascader, TextArea, RadioButtonGroup, Select, InlineField, InlineFieldRow, CascaderOption } from '@grafana/ui'
import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { DataSource } from './datasource'
import type { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter, RawQuery, AssetProperty, Measurement, Asset } from './types'

interface State {
  tabIndex: number
  collectors: Array<SelectableValue<string>>
  databases: Array<SelectableValue<string>>
  filter: MeasurementFilter
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
    this.setCurrentQuery = this.setCurrentQuery.bind(this)
  }

  state = {
    tabIndex: 0,
    filter: {
      Database: '',
      Collector: '',
    },
    collectors: [],
    databases: [],
    measurements: [],
  } as State

  componentDidMount() {
    const collectors = this.getCollectors()
    const databases = this.getTimeseriesDatabases()
    const assets = this.getAssets()
    this.setState({ ...this.state, databases: databases, collectors: collectors, assets: assets })
  }

  setTabIndex(index: number) {
    this.setState({ ...this.state, tabIndex: index })
  }

  getCollectors(): Array<SelectableValue<string>> {
    const result: Array<SelectableValue<string>> = [{ label: 'All collectors', value: '' }]
    this.props.datasource.getCollectors().then((collectors) => {
      collectors.forEach((collector) => {
        result.push({ label: collector.Name, value: collector.UUID, description: collector.Description })
      })
    })

    return result
  }

  onCollectorChange = (event: SelectableValue<string>) => {
    this.setState({ ...this.state, filter: { ...this.state.filter, Collector: event.value } })
  };

  getTimeseriesDatabases(): Array<SelectableValue<string>> {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    this.props.datasource.getTimeseriesDatabases().then((timeseriesDatabases) => {
      timeseriesDatabases.forEach((timeseriesDatabase) => {
        result.push({ label: timeseriesDatabase.Name, value: timeseriesDatabase.UUID, description: timeseriesDatabase.Description })
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
    await this.props.datasource.getMeasurements(filter).then((measurements) => {
      this.setState({ ...this.state, measurements: measurements })
      measurements.forEach((measurement) => {
        result.push({ label: measurement.Name, value: measurement.UUID, description: '(' + measurement.UoM + ') ' + measurement.Description })
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

  setCurrentQuery(queryString: string) {
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
              <InlineField label="Collector" grow tooltip="Specify a collector to work with">
                <Select
                  value={selectable(this.state.collectors, this.state.filter.Collector)}
                  placeholder="select collector"
                  options={this.state.collectors}
                  onChange={this.onCollectorChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Database" grow tooltip="Specify a time series database to work with">
                <Select
                  value={selectable(this.state.databases, this.state.filter.Database)}
                  placeholder="select timeseries database"
                  options={this.state.databases}
                  onChange={this.onTimeseriesDatabaseChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Measurement" grow tooltip="Specify measurement to work with">
                <AsyncSelect
                  placeholder="select measurement"
                  loadOptions={this.loadMeasurementOptions}
                  onChange={this.onMeasurementChange}

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
            <InlineField label="Asset" grow tooltip="Specify asset to work with">
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
              <InlineField label="Database" grow tooltip="Specify a time series database to work with">
                <Select
                  value={selectable(this.state.databases, this.state.filter.Database)}
                  placeholder="select timeseries database"
                  options={this.state.databases}
                  onChange={this.onTimeseriesDatabaseChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <TextArea
                aria-label="query"
                rows={3}
                spellCheck={false}
                placeholder="Raw Query"
                onBlur={(e) => this.setCurrentQuery(e.currentTarget.value)}
                onChange={(e) => {
                  this.setCurrentQuery(e.currentTarget.value);
                }}
              />
            </InlineFieldRow>
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
        <InlineFieldRow>
          <InlineField>
            {tabs[this.state.tabIndex].content}
          </InlineField>
        </InlineFieldRow>
      </div>
    )
  }
}
