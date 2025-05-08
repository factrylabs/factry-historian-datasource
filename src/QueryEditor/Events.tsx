import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import {
  defaultQueryOptions,
  matchedAssets,
  tagsToQueryTags,
  useDebounce,
} from './util'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'
import {
  Asset,
  EventPropertyFilter,
  EventQuery,
  labelWidth,
  MeasurementQueryOptions,
  PropertyType,
} from 'types'
import { EventFilter } from './EventFilter'

export interface Props {
  query: EventQuery
  seriesLimit: number
  datasource: DataSource
  appIsAlertingType?: boolean
  isAnnotationQuery?: boolean
  onChangeEventQuery: (query: EventQuery) => void
  onChangeSeriesLimit: (value: number) => void
}

export const Events = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [limit, setLimit] = useDebounce<number>(props.query.Limit ?? 1000, 500, (value: number) => {
    const updatedQuery = { ...props.query, Limit: value, Type: PropertyType.Simple } as EventQuery
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

  const onChangeAssets = (assets: string[]) => {
    props.onChangeEventQuery({ ...props.query, Assets: assets })
  }

  const onChangeEventTypes = (eventTypes: string[]) => {
    props.onChangeEventQuery({ ...props.query, EventTypes: eventTypes })
  }

  const onChangeStatuses = (statuses: string[]) => {
    props.onChangeEventQuery({ ...props.query, Statuses: statuses })
  }

  const onChangeQueryType = (queryType: PropertyType) => {
    const updatedQuery = { ...props.query, Type: queryType }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeProperties = (properties: string[]) => {
    const updatedQuery = { ...props.query, Properties: properties }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeEventPropertyFilter = (propertyFilter: EventPropertyFilter[]) => {
    const updatedQuery = { ...props.query, PropertyFilter: propertyFilter }
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

  const onChangeAssetProperties = (values: string[]): void => {
    const updatedQuery = { ...props.query, AssetProperties: values }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryOptions = (options: MeasurementQueryOptions): void => {
    const updatedQuery = { ...props.query, Options: options }
    props.onChangeEventQuery(updatedQuery)
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
              onChangeAssets={onChangeAssets}
              onChangeEventTypes={onChangeEventTypes}
              onChangeStatuses={onChangeStatuses}
              onChangeQueryType={onChangeQueryType}
              onChangeProperties={onChangeProperties}
              onChangeEventPropertyFilter={onChangeEventPropertyFilter}
            />
            <InlineFieldRow>
              <InlineField
                label="Include parent info"
                tooltip="For simple properties it will add columns for the parent event and for periodic properties it will add labels"
                labelWidth={labelWidth}
              >
                <InlineSwitch value={props.query.IncludeParentInfo} onChange={onChangeIncludeParentInfo} />
              </InlineField>
            </InlineFieldRow>
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
          <FieldSet label="Query asset properties">
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
                selectedAssets={getSelectedAssets(props.query.Assets.length ? props.query.Assets[0] : '', assets)}
                templateVariables={templateVariables}
                tags={tagsToQueryTags(props.query.Options?.Tags)}
                queryType={props.query.Type}
                onChangeAssetProperties={onChangeAssetProperties}
                onChangeQueryOptions={onChangeQueryOptions}
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
