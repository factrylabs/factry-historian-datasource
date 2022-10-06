import React, { PureComponent } from 'react';
import { AsyncSelect, Select, SegmentSection, InlineField } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { HistorianDataSourceOptions, MeasurementQuery, Query, MeasurementFilter } from './types';

interface State {
  collectors: Array<SelectableValue<string>>
  databases: Array<SelectableValue<string>>
  filter: MeasurementFilter
  measurements: Array<SelectableValue<string>>
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
  }

  state = {
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
    this.setState({ ...this.state, databases: databases, collectors: collectors })
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
    if (event.value) {
      this.setState({ ...this.state, filter: { ...this.state.filter, Collector: event.value } })
    }
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
    if (event.value) {
      this.setState({ ...this.state, filter: { ...this.state.filter, Database: event.value } })
    }
  };

  async loadMeasurementOptions(query: string): Promise<Array<SelectableValue<string>>> {
    const result: Array<SelectableValue<string>> = [];
    const filter = { ...this.state.filter, Keyword: query }
    await this.props.datasource.getMeasurements(filter).then((measurements: any[]) => {
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
      query.query = {} as MeasurementQuery;
      query.query.MeasurementUUIDs = [event.value];
      onChange(query);
    }
  };

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode;
      }>
  ) {
    if (props.query.queryType && props.query.query?.MeasurementUUIDs?.length === 1) {
      this.props.onRunQuery();
    }
  }

  render() {
    return (
      <div className="gf-form">
        <SegmentSection label="SELECT" >
          <InlineField label="Collector" grow tooltip="Specify a collector to work with">
            <Select
              value={selectable(this.state.collectors, this.state.filter.Collector)}
              placeholder="select collector"
              options={this.state.collectors}
              onChange={this.onCollectorChange}
              width={30}
            />
          </InlineField>
          <InlineField label="Database" grow tooltip="Specify a time series database to work with">
            <Select
              value={selectable(this.state.databases, this.state.filter.Database)}
              placeholder="select timeseries database"
              options={this.state.databases}
              onChange={this.onTimeseriesDatabaseChange}
              width={30}
            />
          </InlineField>
          <InlineField label="Measurement" grow tooltip="Specify measurement to work with">
            <AsyncSelect
              placeholder="select measurement"
              cacheOptions
              loadOptions={this.loadMeasurementOptions}
              onChange={this.onMeasurementChange}
              width={30}
            />
          </InlineField>
        </SegmentSection>
      </div>
    );
  }
}
