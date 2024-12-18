import React, { useEffect, useState } from 'react'

import { QueryEditorProps, SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { TemplateSrv, getTemplateSrv } from '@grafana/runtime'
import { DataSource } from 'datasource'
import { MeasurementFilterRow } from './MeasurementFilter'
import { AssetFilterRow } from './AssetFilter'
import { AssetPropertyFilterRow } from './AssetPropertyFilter'
import { DatabaseFilterRow } from './DatabaseFilter'
import { HistorianDataSourceOptions, HistorianInfo, Query, VariableQuery, VariableQueryType } from 'types'
import { EventTypePropertyFilterRow } from './EventTypePropertyFilter'
import { EventTypeFilterRow } from './EventTypeFilter'
import { PropertyValuesFilterRow } from './PropertyValuesFilter'
import { isFeatureEnabled } from 'util/semver'

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
        const historianInfo = await props.datasource.getInfo()
        setHistorianInfo(historianInfo)
      } catch (_) {}
      setLoading(false)
    }
    if (loading) {
      load()
    }
  }, [loading, props.datasource])

  const queryTypeOptions = () => {
    const options = [
      { label: 'Measurement', value: VariableQueryType.MeasurementQuery },
      { label: 'Asset', value: VariableQueryType.AssetQuery },
      { label: 'Event type', value: VariableQueryType.EventTypeQuery },
      { label: 'Database', value: VariableQueryType.DatabaseQuery },
      { label: 'Event type property', value: VariableQueryType.EventTypePropertyQuery },
      { label: 'Asset property', value: VariableQueryType.AssetPropertyQuery },
    ] as Array<SelectableValue<string>>

    if (historianInfo !== undefined && isFeatureEnabled(historianInfo.Version, 'v7.2.0', true)) {
      options.push({ label: 'Event property values', value: VariableQueryType.PropertyValuesQuery })
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
          labelWidth={20}
          tooltip={
            <div>The Factry Historian data source plugin provides the following query types for template variables</div>
          }
        >
          <Select
            placeholder="Select query type"
            aria-label="Query type"
            width={25}
            options={queryTypeOptions()}
            onChange={(value) => {
              if (value.value! === VariableQueryType.MeasurementQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: false,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.AssetQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: false,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.EventTypeQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: false,
                  filter: {},
                })
              }
              if (value.value! === VariableQueryType.DatabaseQuery) {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  valid: false,
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
                    },
                  },
                })
              }
            }}
            value={props.query.type}
          />
        </InlineField>
      </InlineFieldRow>

      {props.query.type === VariableQueryType.MeasurementQuery && (
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
          onChange={(val) => {
            if (props.query.type === VariableQueryType.AssetPropertyQuery) {
              props.onChange({ ...props.query, filter: val })
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
          historianInfo={historianInfo}
          onChange={(val) => {
            if (props.query.type === VariableQueryType.EventTypePropertyQuery) {
              props.onChange({ ...props.query, filter: val })
            }
          }}
        />
      )}
      {props.query.type === VariableQueryType.PropertyValuesQuery &&
        historianInfo &&
        isFeatureEnabled(historianInfo.Version, 'v7.2.0', true) && (
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
