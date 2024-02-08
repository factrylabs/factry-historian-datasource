import React from 'react'

import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { TemplateSrv, getTemplateSrv } from '@grafana/runtime'
import { DataSource } from 'datasource'
import { MeasurementFilterRow } from './MeasurementFilter'
import { AssetFilterRow } from './AssetFilter'
import { AssetPropertyFilterRow } from './AssetPropertyFilter'
import { DatabaseFilterRow } from './DatabaseFilter'
import { HistorianDataSourceOptions, Query, VariableQuery } from 'types'
import { EventTypePropertyFilterRow } from './EventTypePropertyFilter'
import { EventTypeFilterRow } from './EventTypeFilter'

export function VariableQueryEditor(
  props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions, VariableQuery>
) {
  const templateSrv: TemplateSrv = getTemplateSrv()
  const templateVariables = templateSrv.getVariables().map((e) => {
    return {
      label: `$${e.name}`,
      value: `$${e.name}`,
    } as SelectableValue<string>
  })
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
                  filter: {},
                })
              }
              if (value.value! === 'AssetQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
              if (value.value! === 'EventTypeQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
              if (value.value! === 'DatabaseQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
              if (value.value! === 'EventTypePropertyQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
              if (value.value! === 'AssetPropertyQuery') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
            }}
            value={props.query.type}
          />
        </InlineField>
      </InlineFieldRow>

      {props.query.type === 'MeasurementQuery' && (
        <MeasurementFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === 'MeasurementQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === 'AssetQuery' && (
        <AssetFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === 'AssetQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === 'AssetPropertyQuery' && (
        <AssetPropertyFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === 'AssetPropertyQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === 'DatabaseQuery' && (
        <DatabaseFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          onChange={(val) => {
            if (props.query.type === 'DatabaseQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === 'EventTypeQuery' && (
        <EventTypeFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          onChange={(val) => {
            if (props.query.type === 'EventTypeQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === 'EventTypePropertyQuery' && (
        <EventTypePropertyFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === 'EventTypePropertyQuery') {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
    </>
  )
}
