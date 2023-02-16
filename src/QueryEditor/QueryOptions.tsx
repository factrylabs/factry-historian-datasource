import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, InlineLabel, InlineSwitch, Input, Select } from '@grafana/ui'
import { Aggregation, Attributes, labelWidth, MeasurementQueryOptions } from 'types'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { getAggregations, getPeriods } from './util'
import { GroupBySection } from 'components/GroupBySection/GroupBySection'

export interface Props {
  state: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  onChange: (options: MeasurementQueryOptions, tags: QueryTag[]) => void
}

export const QueryOptions = ({ state, tags, appIsAlertingType, onChange }: Props): JSX.Element => {
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
    updatedTags.forEach((tag) => {
      tags[tag.key] = tag.value
    })
    onChange({ ...state, Tags: tags }, updatedTags)
  }

  const onGroupByChange = (groups: string[]): void => {
    onChange({ ...state, GroupBy: groups }, tags)
  }

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...state, Limit: event.target.valueAsNumber }, tags)
  }

  const onPeriodChange = (selected: SelectableValue<string>): void => {
    if (selected.value) {
      const aggregation = {
        ...state.Aggregation,
        Period: selected.value,
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

  const onChangeDisplayDatabaseName = (e: any): void => {
    onChange({ ...state, DisplayDatabaseName: e.target.checked }, tags)
  }

  const onChangeDisplayDescription = (e: any): void => {
    onChange({ ...state, DisplayDescription: e.target.checked }, tags)
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField
          label="Aggregation"
          labelWidth={labelWidth}
          tooltip="Specify an aggregation, leave empty to query raw data"
        >
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
        <InlineLabel width={labelWidth} tooltip="Add all tags to group by">
          Group by
        </InlineLabel>
        <GroupBySection groups={state.GroupBy || []} onChange={onGroupByChange} />
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Filter tags" labelWidth={labelWidth}>
          <TagsSection tags={tags} conditions={['AND']} onChange={handleTagsSectionChange} />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Include last known point"
          tooltip="Includes the last known point before the selected time range"
          labelWidth={labelWidth}
        >
          <InlineSwitch value={state.IncludeLastKnownPoint} onChange={onChangeIncludeLastKnownPoint} />
        </InlineField>
        {!appIsAlertingType && (
          <InlineField label="Use engineering specs">
            <InlineSwitch value={state.UseEngineeringSpecs} onChange={onChangeUseEngineeringSpecs} />
          </InlineField>
        )}
        <InlineField label="Display database name">
          <InlineSwitch value={state.DisplayDatabaseName} onChange={onChangeDisplayDatabaseName} />
        </InlineField>

        <InlineField label="Display description">
          <InlineSwitch value={state.DisplayDescription} onChange={onChangeDisplayDescription} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={labelWidth}>
          <Input placeholder="(optional)" type="number" onBlur={onLimitChange} defaultValue={state.Limit} />
        </InlineField>
      </InlineFieldRow>
    </div>
  )
}
