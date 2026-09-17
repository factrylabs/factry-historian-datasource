import React, { useEffect, useState } from 'react'

import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { TemplateSrv, getTemplateSrv } from '@grafana/runtime'
import { DataSource } from 'datasource'
import { MeasurementFilterRow } from './MeasurementFilter'
import { AssetFilterRow } from './AssetFilter'
import { AssetPropertyFilterRow } from './AssetPropertyFilter'
import { DatabaseFilterRow } from './DatabaseFilter'
import { LookupTableFilterRow } from './LookupTableFilter'
import {
  fieldWidth,
  HistorianDataSourceOptions,
  HistorianInfo,
  labelWidth,
  Query,
  VariableQuery,
  VariableQueryType,
} from 'types'
import { isLookupTablesEnabled } from 'QueryEditor/util'
import { EventTypePropertyFilterRow } from './EventTypePropertyFilter'
import { EventTypeFilterRow } from './EventTypeFilter'
import { PropertyValuesFilterRow } from './PropertyValuesFilter'
import { Pagination } from './Pagination'

export function VariableQueryEditor(
  props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions, VariableQuery>
) {
  const [loading, setLoading] = useState(true)
  const [historianInfo, setHistorianInfo] = useState<HistorianInfo | undefined>(undefined)

  const templateSrv: TemplateSrv = getTemplateSrv()
  const templateVariables = templateSrv.getVariables().map((e) => {
    return {
      label: `$${e.name}`,
      value: `$${e.name}`,
    } as SelectableValue<string>
  })

  useEffect(() => {
    const load = async () => {
      try {
        await props.datasource.getInfo()
        setHistorianInfo(props.datasource.historianInfo)
      } catch (_) {}
      setLoading(false)
    }
    if (loading) {
      load()
    }
  }, [loading, props.datasource])

  const queryTypeOptions = (): Array<SelectableValue<string>> => {
    const options: Array<SelectableValue<string>> = [
      { label: 'Measurement', value: VariableQueryType.MeasurementQuery },
      { label: 'Asset', value: VariableQueryType.AssetQuery },
      { label: 'Event type', value: VariableQueryType.EventTypeQuery },
      { label: 'Database', value: VariableQueryType.DatabaseQuery },
      { label: 'Event type property', value: VariableQueryType.EventTypePropertyQuery },
      { label: 'Asset property', value: VariableQueryType.AssetPropertyQuery },
      { label: 'Event property values', value: VariableQueryType.PropertyValuesQuery },
    ]

    // Only offered on a historian with the lookup table endpoints, since a variable of this
    // type could only 404 on one without them. A variable already saved as one keeps the
    // option whatever the historian says, so that its own type does not go missing from the
    // list it is selected in.
    if (
      isLookupTablesEnabled(historianInfo?.Version) ||
      props.query.type === VariableQueryType.LookupTableValuesQuery
    ) {
      options.push({ label: 'Lookup table values', value: VariableQueryType.LookupTableValuesQuery })
    }

    return options
  }

  return loading ? (
    <></>
  ) : (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query type"
          labelWidth={labelWidth}
          tooltip={
            <div>The Factry Historian data source plugin provides the following query types for template variables</div>
          }
        >
          <Select
            placeholder="Select query type"
            aria-label="Query type"
            width={fieldWidth}
            options={queryTypeOptions()}
            onChange={(value) => {
              if (value.value! === VariableQueryType.MeasurementQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: true,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.AssetQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: true,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.EventTypeQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: true,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.DatabaseQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: true,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.EventTypePropertyQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.AssetPropertyQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: true,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.LookupTableValuesQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  // Invalid until a table and a value column are picked, so the variable
                  // does not query before it names anything.
                  valid: false,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.PropertyValuesQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  filter: {
                    EventFilter: {
                      Type: 'simple',
                      Assets: [],
                      EventTypes: [],
                      Properties: [],
                      PropertyFilter: [],
                      QueryAssetProperties: false,
                      OverrideAssets: [],
                      OverrideTimeRange: false,
                      TimeRange: { from: '', to: '' },
                      Ascending: false,
                    },
                  },
                })
              }
            }}
            value={props.query.type}
          />
        </InlineField>
      </InlineFieldRow>
      <br />
      {props.query.type === VariableQueryType.MeasurementQuery && (
        <>
          <MeasurementFilterRow
            datasource={props.datasource}
            initialValue={props.query.filter}
            templateVariables={templateVariables}
            onChange={(val, valid) => {
              if (props.query.type === VariableQueryType.MeasurementQuery) {
                props.onChange({ ...props.query, filter: val, valid: valid })
              }
            }}
          />
          <Pagination
            initialValue={props.query.pagination}
            tooltipText="Maximum amount of measurements to fetch"
            onChange={(pagination) => {
              if (props.query.type === VariableQueryType.MeasurementQuery) {
                props.onChange({ ...props.query, pagination: pagination })
              }
            }}
          />
        </>
      )}
      {props.query.type === VariableQueryType.AssetQuery && (
        <AssetFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val, valid) => {
            if (props.query.type === VariableQueryType.AssetQuery) {
              props.onChange({ ...props.query, filter: val, valid: valid })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.AssetPropertyQuery && (
        <AssetPropertyFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val, valid) => {
            if (props.query.type === VariableQueryType.AssetPropertyQuery) {
              props.onChange({ ...props.query, filter: val, valid: valid })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.DatabaseQuery && (
        <DatabaseFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          onChange={(val, valid) => {
            if (props.query.type === VariableQueryType.DatabaseQuery) {
              props.onChange({ ...props.query, filter: val, valid: valid })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.EventTypeQuery && (
        <EventTypeFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          onChange={(val, valid) => {
            if (props.query.type === VariableQueryType.EventTypeQuery) {
              props.onChange({ ...props.query, filter: val, valid: valid })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.EventTypePropertyQuery && (
        <EventTypePropertyFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === VariableQueryType.EventTypePropertyQuery) {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.LookupTableValuesQuery && (
        <LookupTableFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val, valid) => {
            if (props.query.type === VariableQueryType.LookupTableValuesQuery) {
              props.onChange({ ...props.query, filter: val, valid: valid })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.PropertyValuesQuery && (
        <PropertyValuesFilterRow
          datasource={props.datasource}
          initialValue={props.query.filter}
          templateVariables={templateVariables}
          onChange={(val) => {
            if (props.query.type === VariableQueryType.PropertyValuesQuery) {
              props.onChange({ ...props.query, filter: val })
            }
          }}
          historianInfo={historianInfo}
        />
      )}
    </>
  )
}
