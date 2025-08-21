import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui'
import { DateTime } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { defaultQueryOptions, matchedAssets, tagsToQueryTags, useDebounce } from './util'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'
import {
  Asset,
  AssetMeasurementQuery,
  AssetPropertySelectionMethod,
  EventQuery,
  labelWidth,
  PropertyType,
  TimeRange,
} from 'types'
import { EventFilter } from './EventFilter'
import { DateRangePicker } from 'components/util/DateRangePicker'

export interface Props {
  query: EventQuery
  seriesLimit: number
  datasource: DataSource
  appIsAlertingType?: boolean
  isAnnotationQuery?: boolean
  range?: { from: DateTime; to: DateTime }
  onChangeEventQuery: (query: EventQuery) => void
  onChangeSeriesLimit: (value: number) => void
}

export const Events = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [limit, setLimit] = useDebounce<number | undefined>(props.query.Limit, 500, (value: number | undefined) => {
    if (value === props.query.Limit) {
      return
    }

    const updatedQuery = { ...props.query, Limit: value } as EventQuery
    props.onChangeEventQuery(updatedQuery)
  })
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  const fetchAll = useCallback(async () => {
    const assets = await props.datasource.getAssets()
    setAssets(assets)
  }, [props.datasource])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        await fetchAll()
        setLoading(false)
      })()
    }
  }, [loading, fetchAll])

  const getSelectedAssets = (selected: string | undefined, assets: Asset[]): Asset[] => {
    const replacedAssets = props.datasource.multiSelectReplace(selected, {})
    return matchedAssets(replacedAssets, assets)
  }

  const onChangeOverrideTimeRange = (event: ChangeEvent<HTMLInputElement>): void => {
    let updatedQuery = {
      ...props.query,
      OverrideTimeRange: event.target.checked,
    }
    // When the override time range is enabled, we set the time range to that of the dashboard
    if (event.target.checked) {
      updatedQuery.TimeRange = {
        from: props.range?.from.toString() || '',
        to: props.range?.to.toString() || '',
      }
    }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryAssetProperties = (event: FormEvent<HTMLInputElement>): void => {
    const enabled = (event as ChangeEvent<HTMLInputElement>).target.checked
    const updatedQuery = { ...props.query, QueryAssetProperties: enabled } as EventQuery
    if (enabled && !updatedQuery.Options) {
      updatedQuery.Options = defaultQueryOptions(props.appIsAlertingType ?? false)
    }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeIncludeParentInfo = (event: FormEvent<HTMLInputElement>): void => {
    const enabled = (event as ChangeEvent<HTMLInputElement>).target.checked
    const updatedQuery = { ...props.query, IncludeParentInfo: enabled } as EventQuery
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeLimit = (event: ChangeEvent<HTMLInputElement>): void => {
    setLimit(Number(event.target.value))
  }

  const onChangeAssetMeasurementQuery = (query: AssetMeasurementQuery): void => {
    const updateQuery = {
      ...props.query,
      OverrideAssets: query.Assets,
      AssetProperties: query.AssetProperties,
      Options: query.Options,
      AssetPropertySelectionMethod: query.AssetPropertySelectionMethod,
    }
    props.onChangeEventQuery(updateQuery)
  }

  const onChangeTimeRange = (value: TimeRange): void => {
    const updatedQuery = { ...props.query, TimeRange: value }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeEventFilter = (query: EventQuery): void => {
    const updatedQuery = { ...props.query, ...query }
    props.onChangeEventQuery(updatedQuery)
  }

  const selectedAsset = (assets: string[], overrideAssets: string[]): string => {
    if (overrideAssets.length > 0) {
      return overrideAssets[0]
    }
    if (assets.length > 0) {
      return assets[0]
    }
    return ''
  }

  return (
    <>
      {!loading && (
        <>
          <FieldSet label="Event query">
            <EventFilter
              query={props.query}
              datasource={props.datasource}
              isAnnotationQuery={props.isAnnotationQuery}
              multiSelectProperties={true}
              onChangeQuery={onChangeEventFilter}
            />
            <InlineFieldRow>
              <InlineField
                label="Include Parent Event"
                tooltip={`Adds the simple properties of the parent event as ${
                  props.query.Type === PropertyType.Simple ? 'fields' : 'labels'
                }`}
                labelWidth={labelWidth}
              >
                <InlineSwitch value={props.query.IncludeParentInfo} onChange={onChangeIncludeParentInfo} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Override time range" labelWidth={labelWidth}>
                <div>
                  <InlineSwitch
                    label="Override time range"
                    value={props.query.OverrideTimeRange}
                    onChange={onChangeOverrideTimeRange}
                  />
                </div>
              </InlineField>
            </InlineFieldRow>
            {props.query.OverrideTimeRange && (
              <DateRangePicker
                override={props.query.OverrideTimeRange}
                dateTimeRange={props.query.TimeRange}
                onChange={onChangeTimeRange}
                datasource={props.datasource}
              />
            )}
            <InlineFieldRow>
              <InlineField
                label="Limit"
                tooltip="Limit the number of events returned, 0 for no limit"
                labelWidth={labelWidth}
              >
                <Input value={limit} type="number" min={0} onChange={onChangeLimit} />
              </InlineField>
            </InlineFieldRow>
          </FieldSet>
          <FieldSet label="Fetch Asset Properties">
            <InlineFieldRow>
              <InlineField label="Enabled" labelWidth={labelWidth}>
                <InlineSwitch value={props.query.QueryAssetProperties} onChange={onChangeQueryAssetProperties} />
              </InlineField>
            </InlineFieldRow>
            {props.query.QueryAssetProperties && (
              <EventAssetProperties
                appIsAlertingType={props.appIsAlertingType ?? false}
                datasource={props.datasource}
                seriesLimit={props.seriesLimit}
                queryOptions={props.query.Options ?? defaultQueryOptions(props.appIsAlertingType ?? false)}
                selectedAssetProperties={props.query.AssetProperties ?? []}
                assetPropertySelectionMethod={
                  props.query.AssetPropertySelectionMethod ?? AssetPropertySelectionMethod.PerAsset
                }
                overrideAssets={props.query.OverrideAssets ?? []}
                selectedAssets={getSelectedAssets(
                  selectedAsset(props.query.Assets, props.query.OverrideAssets),
                  assets
                )}
                templateVariables={templateVariables}
                tags={tagsToQueryTags(props.query.Options?.Tags)}
                queryType={props.query.Type}
                onChangeAssetMeasurementQuery={onChangeAssetMeasurementQuery}
                onChangeSeriesLimit={props.onChangeSeriesLimit}
                onOpenMenu={fetchAll}
              />
            )}
          </FieldSet>
        </>
      )}
    </>
  )
}
