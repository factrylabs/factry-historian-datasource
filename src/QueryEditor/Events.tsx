import React, { ChangeEvent, FormEvent, useState } from 'react'
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, Input, RadioButtonGroup } from '@grafana/ui'
import { DateTime } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { defaultQueryOptions, tagsToQueryTags, useDebounce } from './util'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'
import { AssetMeasurementQuery, EventQuery, labelWidth, PropertyType, TimeRange } from 'types'
import { EventFilter } from './EventFilter'
import { DateRangePicker } from 'components/util/DateRangePicker'

export interface Props {
  query: EventQuery
  seriesLimit: number | string
  datasource: DataSource
  appIsAlertingType?: boolean
  isAnnotationQuery?: boolean
  range?: { from: DateTime; to: DateTime }
  onChangeEventQuery: (query: EventQuery) => void
  onChangeSeriesLimit: (value: number | string) => void
}

export const Events = (props: Props): JSX.Element => {
  const [ordering, setOrdering] = useState(props.query.Ascending ? 'ascending' : 'descending')
  const [limit, setLimit] = useDebounce<number | string | undefined>(
    props.query.Limit,
    500,
    (value: number | string | undefined) => {
      if (value === props.query.Limit) {
        return
      }

      const updatedQuery = { ...props.query, Limit: value } as EventQuery
      props.onChangeEventQuery(updatedQuery)
    }
  )
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

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

  const onChangeLimit = (event: ChangeEvent<HTMLInputElement> | null): void => {
    const value = event?.target.value
    setLimit(value === '' ? undefined : value)
  }

  const onChangeAssetMeasurementQuery = (query: AssetMeasurementQuery): void => {
    const updateQuery = {
      ...props.query,
      OverrideAssets: query.Assets,
      AssetProperties: query.AssetProperties,
      Options: query.Options,
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

  const onChangeOrder = (value: string): void => {
    setOrdering(value)

    const updatedQuery = { ...props.query, Ascending: value === 'ascending' }
    props.onChangeEventQuery(updatedQuery)
  }

  return (
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
            <Input value={limit} onChange={(e) => setLimit(e.currentTarget.value)} onBlur={onChangeLimit} />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Order by time"
            labelWidth={labelWidth}
            tooltip="In what way returned data should be ordered in time"
          >
            <RadioButtonGroup
              options={[
                { label: 'Ascending', value: 'ascending' },
                { label: 'Descending', value: 'descending' },
              ]}
              onChange={onChangeOrder}
              value={ordering}
            />
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
            overrideAssets={props.query.OverrideAssets ?? []}
            templateVariables={templateVariables}
            tags={tagsToQueryTags(props.query.Options?.Tags)}
            queryType={props.query.Type}
            onChangeAssetMeasurementQuery={onChangeAssetMeasurementQuery}
            onChangeSeriesLimit={props.onChangeSeriesLimit}
          />
        )}
      </FieldSet>
    </>
  )
}
