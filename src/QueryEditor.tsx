import React, { PureComponent } from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { AsyncSelect, Cascader, TextArea, RadioButtonGroup, Select, InlineField, InlineFieldRow, CascaderOption } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter, RawQuery } from './types';

interface State {
  tabIndex: number
  collectors: Array<SelectableValue<string>>
  databases: Array<SelectableValue<string>>
  filter: MeasurementFilter
  measurements: Array<any>
  assets: Array<CascaderOption>
}

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>;

function selectable(store: Array<SelectableValue<string>>, value?: string): SelectableValue<string> {
  if (value === undefined) {
    return {};
  }

  return store.filter((e) => e.value === value)
}

export class QueryEditor extends PureComponent<Props, State> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props);
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
    const result: Array<SelectableValue<string>> = [{ label: 'All collectors', value: '' }];
    this.props.datasource.getCollectors().then((collectors: any[]) => {
      collectors.forEach((collector: any) => {
        result.push({ label: collector.Name, value: collector.UUID, description: collector.Description });
      });
    });

    return result
  }

  onCollectorChange = (event: SelectableValue<string>) => {
    this.setState({ ...this.state, filter: { ...this.state.filter, Collector: event.value } })
  };

  getTimeseriesDatabases(): Array<SelectableValue<string>> {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }];
    this.props.datasource.getTimeseriesDatabases().then((timeseriesDatabases: any[]) => {
      timeseriesDatabases.forEach((timeseriesDatabase: any) => {
        result.push({ label: timeseriesDatabase.Name, value: timeseriesDatabase.UUID, description: timeseriesDatabase.Description });
      });
    });

    return result
  }

  onTimeseriesDatabaseChange = (event: SelectableValue<string>) => {
    this.setState({ ...this.state, filter: { ...this.state.filter, Database: event.value } })
  }

  async loadMeasurementOptions(query: string): Promise<Array<SelectableValue<string>>> {
    const result: Array<SelectableValue<string>> = [];
    const filter = { ...this.state.filter, Keyword: query }
    await this.props.datasource.getMeasurements(filter).then((measurements: any[]) => {
      this.setState({ ...this.state, measurements: measurements })
      measurements.forEach((measurement: any) => {
        result.push({ label: measurement.Name, value: measurement.UUID, description: '(' + measurement.UoM + ') ' + measurement.Description });
      });
    })
    return result
  }

  onMeasurementChange = (event: SelectableValue<string>) => {
    if (event.value) {
      const { onChange, query } = this.props;
      query.queryType = 'MeasurementQuery';
      query.query = {
        Measurements: [this.state.measurements.find((m) => m.UUID === event.value)],
        GroupBy: ['status']
      } as MeasurementQuery;
      onChange(query);
    }
  };

  getAssets(): Array<CascaderOption> {
    const result: Array<CascaderOption> = []
    this.props.datasource.getAssets().then((assets: any[]) => {
      assets.filter((asset) => !asset.ParentUUID).forEach((asset: any) => {
        const cascaderOption: CascaderOption = {
          label: asset.Name,
          value: asset.UUID,
          items: this.getChildAssets(asset, assets)
        }
        result.push(cascaderOption);
      })
    })

    return result
  }

  getChildAssets(parent, assets): Array<CascaderOption> {
    const result: Array<CascaderOption> = [];

    assets.filter((asset) => asset.ParentUUID === parent.UUID).forEach((asset) => {
      const cascaderOption: CascaderOption = {
        label: asset.Name,
        value: asset.UUID,
        items: this.getChildAssets(asset, assets)
      }
      result.push(cascaderOption)
    })

    return result
  }

  onSelectAsset(asset: string) {
    // TODO pass an array of assets instead of a single asset, is simpler to implement include children...
    // OR add an includeChildren option which adds some complexity to the historian but limits the length of the querystring
    this.setState({ ...this.state, filter: { ...this.state.filter, Asset: asset } })
  }

  setCurrentQuery(queryString: string) {
    console.log(queryString)
    const { onChange, query } = this.props
    query.queryType = 'RawQuery'
    if (getTemplateSrv().getVariables().length > 0) {
      queryString = getTemplateSrv().replace(queryString)
    }
    query.query = {
      TimeseriesDatabase: this.state.filter.Database,
      Query: queryString,
    } as RawQuery
    console.log(query.query)
    onChange(query)
  }

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode;
      }>
  ) {
    if (props.query.queryType) {
      this.props.onRunQuery();
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
                getSearchableOptions={this.state.assets}
                displayAllSelectedLevels
                onSelect={this.onSelectAsset}
              />
            </InlineField>
            <InlineField label="Measurement" grow tooltip="Specify measurement to work with">
              <AsyncSelect
                placeholder="select measurement"
                loadOptions={this.loadMeasurementOptions}
                onChange={this.onMeasurementChange}
                width={30}
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
        {/* TODO Display status? */}
        {/* Depending on content of this.props fill values of input / show correct tab */}
        {/* select mean(value) as value from "rand float" where $timeFilter GROUP BY $__interval fill(null) order by time desc */}
        {/* select value from "rand float" where $timeFilter order by time desc */}
      </div>
    );
  }
}
