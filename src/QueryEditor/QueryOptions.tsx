import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, InlineSwitch, Input, Select } from '@grafana/ui'
import { Aggregation, Attributes, MeasurementQueryOptions } from 'types'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { getAggregations, getPeriods } from './util'

export interface Props {
  state: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  onChange: (options: MeasurementQueryOptions, tags: QueryTag[]) => void
}

export const QueryOptions = ({
  state, tags, appIsAlertingType,
  onChange
}: Props): JSX.Element => {
  const [periods, setPeriods] = useState(getPeriods())
  const onAggregationChange = (event: SelectableValue<string>) => {
    let aggregation = undefined
    if (event?.value) {
      aggregation = {
        ...state.Aggregation,
        Name: event.value,
      } as Aggregation
    }
    onChange({ ...state, Aggregation: aggregation }, tags)
  }

  const handleTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const tags: Attributes = {}
    updatedTags.forEach(tag => {
      tags[tag.key] = tag.value
    })
    onChange({ ...state, Tags: tags }, updatedTags)
  }

  const onGroupByChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    let groupBy = undefined
    if (event.target.value) {
      groupBy = event.target.value.split(',').map(groupBy => groupBy.trim())
    }
    onChange({ ...state, GroupBy: groupBy }, tags)
  }

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...state, Limit: event.target.valueAsNumber }, tags)
  }

  const onPeriodChange = (selected: SelectableValue<string>): void => {
    if (selected.value) {
      const aggregation = {
        ...state.Aggregation,
        Period: selected.value
      } as Aggregation
      onChange({ ...state, Aggregation: aggregation }, tags)
    }
  }

  const onCreatePeriod = (value: string): void => {
    if (!/^([\d]+[h,m,s])+$/.test(value)) {
      return
    }

    const customValue: SelectableValue<string> = { value: value, label: value }
    setPeriods([...periods, customValue])
    onPeriodChange(customValue)
  }

  const onChangeIncludeLastKnownPoint = (e: any): void => {
    onChange({ ...state, IncludeLastKnownPoint: e.target.checked }, tags)
  }

  const onChangeUseEngineeringSpecs = (e: any): void => {
    onChange({ ...state, UseEngineeringSpecs: e.target.checked }, tags)
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Aggregation" labelWidth={20} tooltip="Specify an aggregation, leave empty to query raw data">
          <Select
            value={state.Aggregation?.Name}
            placeholder="select an aggregation"
            isClearable
            options={getAggregations()}
            onChange={onAggregationChange}
          />
        </InlineField>
        <InlineField>
          <Select
            value={state.Aggregation?.Period}
            options={periods}
            allowCustomValue
            onChange={onPeriodChange}
            onCreateOption={onCreatePeriod}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Group by" labelWidth={20} tooltip="Enter a list of tags to group by separated by ','">
          <Input
            placeholder="group by"
            onBlur={onGroupByChange}
            defaultValue={state.GroupBy?.join(', ')}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Tags" labelWidth={20}>
          <TagsSection
            tags={tags}
            conditions={['AND']}
            onChange={handleTagsSectionChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={20}>
          <Input
            placeholder="(optional)"
            type='number'
            onBlur={onLimitChange}
            defaultValue={state.Limit}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Include last known point" labelWidth={20}>
          <InlineSwitch
            value={state.IncludeLastKnownPoint}
            onChange={onChangeIncludeLastKnownPoint}
          />
        </InlineField>
      </InlineFieldRow>
      {!appIsAlertingType &&
        <InlineFieldRow>
          <InlineField label="Use engineering specs" labelWidth={20} >
            <InlineSwitch
              value={state.UseEngineeringSpecs}
              onChange={onChangeUseEngineeringSpecs}
            />
          </InlineField>
        </InlineFieldRow>
      }
    </div>
  )
}
