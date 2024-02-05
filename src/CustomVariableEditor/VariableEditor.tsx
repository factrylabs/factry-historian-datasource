import React, { ChangeEvent, FormEvent } from 'react';

import { QueryEditorProps } from "@grafana/data";
import { DataSource } from "datasource";
import { HistorianDataSourceOptions, MeasurementFilter, Query, VariableQuery } from "types";
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';

export function VariableQueryEditor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions, VariableQuery>) {
  return (
    <>
      <InlineFieldRow>
        <InlineField
        label="Query type"
        labelWidth={20}
        tooltip={
          <div>The Factry Historian data source plugin provides the following query types for template variables</div>
        }
        >
          <Select
            placeholder="Select query type"
            aria-label="Query type"
            width={25}
            options={[
              { label: 'Measurement', value: 'MeasurementQuery' as const },
              { label: 'Asset', value: 'AssetQuery' as const },
              { label: 'Event type', value: 'EventTypeQuery' as const },
              { label: 'Database', value: 'DatabaseQuery' as const },
              { label: 'Event type property', value: 'EventTypePropertyQuery' as const },
              { label: 'Asset property', value: 'AssetPropertyQuery' as const },
            ]}
            onChange={(value) => {
              if (value.value! === 'MeasurementQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'AssetQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'EventTypeQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'DatabaseQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'EventTypePropertyQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'AssetPropertyQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
            }}
            value={props.query.type}
          />
        </InlineField>
      </InlineFieldRow>

      {(props.query.type === 'MeasurementQuery') && (
        <MeasurementFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          onChange={(val) => {
            // To make TS happy
            if (props.query.type === 'MeasurementQuery') {
              props.onChange({ ...props.query, filter: val });
            }
          }}
        />
      )}
    </>
  )
}

function MeasurementFilterRow(props: {
  datasource: DataSource;
  onChange: (val: MeasurementFilter) => void;
  initialValue?: MeasurementFilter;
}) {

  const onKeywordChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Keyword: (event as ChangeEvent<HTMLInputElement>).target.value
    })
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Keyword'}
          aria-label={'Keyword'}
          labelWidth={20}
          tooltip={<div>Searches measurement by name</div>}
        >
          <Input
            value={props.initialValue?.Keyword}
            onChange={(e) => onKeywordChange(e)}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
