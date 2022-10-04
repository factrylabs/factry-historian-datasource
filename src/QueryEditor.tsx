import React, { PureComponent } from 'react';
import { Select, InlineField } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import { HistorianDataSourceOptions, MeasurementQuery, Query } from './types';

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>;

function selectable(value?: string): SelectableValue<string> {
  if (!value) {
    return {};
  }

  return { label: value, value: value };
}

export class QueryEditor extends PureComponent<Props> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props);
  }

  getMeasurements(): Array<SelectableValue<string>> {
    const result: Array<SelectableValue<string>> = [];
    this.props.datasource.getMeasurements('').then((measurements: any[]) => {
      measurements.forEach((measurement: any) => {
        result.push({ label: measurement.Name, value: measurement.UUID });
      });
    });

    return result;
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
        <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with">
          <Select
            allowCustomValue={true}
            value={selectable(this.props.query.query?.MeasurementUUIDs?.[0] || '')}
            placeholder="measurement"
            options={this.getMeasurements()}
            onChange={this.onMeasurementChange}
            width={90}
          />
        </InlineField>
      </div>
    );
  }
}
