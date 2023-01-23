import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui'
import { Aggregation, Attributes, MeasurementFilter, MeasurementQuery, Query, TimeseriesDatabase } from 'types'
import { QueryTag, TagsSection } from 'TagsSection'
import { getAggregations, getIntervals, selectable } from './util'


export interface Props {
  databases: TimeseriesDatabase[]
  filter: MeasurementFilter
  query: Query
  measurementQuery: MeasurementQuery
  tags: any
  onChange: (query: Query) => void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onRunQuery: () => void
  onTimeseriesDatabaseChange: (database: SelectableValue<string>) => void
  onLoadMeasurementOptions: (query: string) => Promise<Array<SelectableValue<string>>>
  onUpdateTags(updatedTags: Attributes): void
}

export const Measurements = ({
  databases, filter, query, measurementQuery, tags,
  onChange, onRunQuery, onChangeMeasurementQuery,
  onTimeseriesDatabaseChange,
  onLoadMeasurementOptions,
  onUpdateTags
}: Props): JSX.Element => {
  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return result
  }

  const onMeasurementChange = (event: SelectableValue<string>): void => {
    if (event.value) {
      const measurements = [event.value]
      const updatedQuery = { ...measurementQuery, Measurements: measurements }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  const onAggregationChange = (event: SelectableValue<string>) => {
    if (event.value) {
      const aggregation = {
        ...measurementQuery.Aggregation,
        Name: event.value,
      } as Aggregation
      const updatedQuery = { ...measurementQuery, Aggregation: aggregation }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  const handleTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const tags: Attributes = {}
    updatedTags.forEach(tag => {
      tags[tag.key] = tag.value
    })
    const updatedQuery = { ...measurementQuery, Tags: updatedTags }
    onUpdateTags(tags)
    onChangeMeasurementQuery(updatedQuery)
    onRunQuery()
  }

  const onGroupByChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.value) {
      const groupBy = event.target.value.split(',').map(groupBy => groupBy.trim())
      const updatedQuery = { ...measurementQuery, GroupBy: groupBy }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  const onPeriodChange = (selected: SelectableValue<string>): void => {
    if (selected.value) {
      const aggregation = {
        ...measurementQuery.Aggregation,
        Period: selected.value
      } as Aggregation
      const updatedQuery = { ...measurementQuery, Aggregation: aggregation }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(databases), filter.Database)}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with">
          <AsyncSelect
            placeholder="select measurement"
            loadOptions={onLoadMeasurementOptions}
            defaultOptions
            onChange={onMeasurementChange}
            menuShouldPortal

          />
        </InlineField>
        <InlineField>
          <Select
            defaultValue={measurementQuery.Aggregation?.Name}
            placeholder="select an aggregation"
            options={getAggregations()}
            onChange={onAggregationChange}
          />
        </InlineField>
        <TagsSection
          tags={tags}
          onChange={handleTagsSectionChange}
          getTagKeyOptions={() => { return Promise.resolve([]) }}
          getTagValueOptions={(key: string) => { return Promise.resolve([]) }}
        />
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="GROUP BY" labelWidth={20} tooltip="Enter a list of tags to group by separated by ','">
          <Input
            placeholder="group by"
            onChange={onGroupByChange}
            defaultValue="status"
          />
        </InlineField>
        <InlineField>
          <Select
            value={measurementQuery.Aggregation?.Period || "$__interval"}
            options={getIntervals()}
            onChange={onPeriodChange} // TODO allow custom options
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  )
}
