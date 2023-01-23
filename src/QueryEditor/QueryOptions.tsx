import React from 'react'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Input, Select } from '@grafana/ui'
import { Aggregation, Attributes, MeasurementQuery } from 'types'
import { QueryTag, TagsSection } from 'TagsSection'
import { getAggregations, getPeriods } from './util'


export interface Props {
  measurementQuery: MeasurementQuery
  tags: any
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onUpdateTags(updatedTags: Attributes): void
  onRunQuery: () => void
}

export const QueryOptions = ({
  measurementQuery, tags,
  onRunQuery, onChangeMeasurementQuery,
  onUpdateTags
}: Props): JSX.Element => {
  const onAggregationChange = (event: SelectableValue<string>) => {
    let aggregation = undefined
    if (event?.value) {
      aggregation = {
        ...measurementQuery.Aggregation,
        Name: event.value,
      } as Aggregation
    }
    const updatedQuery = { ...measurementQuery, Aggregation: aggregation }
    onChangeMeasurementQuery(updatedQuery)
    onRunQuery()
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
    if (!event.target.value) {
      return
    }

    const groupBy = event.target.value.split(',').map(groupBy => groupBy.trim())
    const updatedQuery = { ...measurementQuery, GroupBy: groupBy }
    onChangeMeasurementQuery(updatedQuery)
    onRunQuery()
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
        <InlineField label="WHERE" labelWidth={20} tooltip="Specify an aggregation, leave empty to query raw data">
          <Select
            value={measurementQuery.Aggregation?.Name}
            placeholder="select an aggregation"
            isClearable
            options={getAggregations()}
            onChange={onAggregationChange}
          />
        </InlineField>
        <TagsSection
          tags={tags}
          onChange={handleTagsSectionChange}
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
            options={getPeriods()}
            onChange={onPeriodChange} // TODO allow custom options
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  )
}
