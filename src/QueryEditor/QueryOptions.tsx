import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { CollapsableSection, InlineField, InlineFieldRow, InlineLabel, InlineSwitch, Input, Select } from '@grafana/ui'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { GroupBySection } from 'components/GroupBySection/GroupBySection'
import { getAggregationsForDatatypes, getFillTypes, getPeriods } from './util'
import { Aggregation, Attributes, labelWidth, MeasurementQueryOptions } from 'types'

export interface Props {
  state: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  datatypes: string[]
  hideInterval?: boolean
  hideFill?: boolean
  hideLimit?: boolean
  hideGroupBy?: boolean
  hideTagFilter?: boolean
  hideAdvancedOptions?: boolean
  templateVariables: Array<SelectableValue<string>>
  getTagKeyOptions?: () => Promise<string[]>
  getTagValueOptions?: (key: string) => Promise<string[]>
  onChange: (options: MeasurementQueryOptions, tags: QueryTag[]) => void
}

export const QueryOptions = ({
  state,
  tags,
  appIsAlertingType,
  datatypes,
  templateVariables,
  hideInterval = false,
  hideFill = false,
  hideLimit = false,
  hideGroupBy = false,
  hideTagFilter = false,
  hideAdvancedOptions = false,
  getTagKeyOptions,
  getTagValueOptions,
  onChange,
}: Props): JSX.Element => {
  const [periods, setPeriods] = useState(getPeriods())

  const getAggregationOptions = (
    datatypes: string[],
    options: MeasurementQueryOptions
  ): Array<SelectableValue<string>> => {
    const validAggregations = getAggregationsForDatatypes(datatypes)
    if (options.Aggregation?.Name !== 'last' && !validAggregations.find((e) => options.Aggregation?.Name === e.value)) {
      onChange(
        {
          ...state,
          Aggregation: {
            ...state.Aggregation,
            Name: 'last',
          },
        },
        tags
      )
    }
    return validAggregations.concat(templateVariables)
  }

  const onAggregationChange = (event: SelectableValue<string>) => {
    let aggregation = undefined
    if (event?.value) {
      aggregation = {
        ...state.Aggregation,
        Name: event.value,
        Period: state.Aggregation?.Period || '$__interval',
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

  const onFillChange = (selected: SelectableValue<string>): void => {
    const aggregation = {
      ...state.Aggregation,
      Fill: selected?.value,
    } as Aggregation

    onChange({ ...state, Aggregation: aggregation }, tags)
  }

  const onChangeIncludeLastKnownPoint = (e: any): void => {
    onChange({ ...state, IncludeLastKnownPoint: e.target.checked }, tags)
  }

  const onChangeFillInitialEmptyValues = (e: any): void => {
    onChange({ ...state, FillInitialEmptyValues: e.target.checked }, tags)
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
    <>
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
            options={getAggregationOptions(datatypes, state)}
            onChange={onAggregationChange}
          />
        </InlineField>
        {!hideInterval && state.Aggregation?.Name && (
          <InlineField>
            <Select
              value={state.Aggregation?.Period}
              options={periods.concat(templateVariables)}
              allowCustomValue
              onChange={onPeriodChange}
              onCreateOption={onCreatePeriod}
            />
          </InlineField>
        )}
        {!hideFill && state.Aggregation?.Name && (
          <InlineField>
            <Select
              value={state.Aggregation?.Fill}
              placeholder="(optional) select a fill type"
              options={getFillTypes().concat(templateVariables)}
              onChange={onFillChange}
              isClearable
            />
          </InlineField>
        )}
      </InlineFieldRow>
      {!hideGroupBy && (
        <InlineFieldRow>
          <InlineLabel width={labelWidth} tooltip="Add all tags to group by">
            Group by
          </InlineLabel>
          <GroupBySection groups={state.GroupBy || []} onChange={onGroupByChange} />
        </InlineFieldRow>
      )}
      {!hideTagFilter && (
        <InlineFieldRow>
          <InlineField label="Filter tags" labelWidth={labelWidth}>
            <TagsSection
              tags={tags}
              conditions={['AND']}
              getTagKeyOptions={getTagKeyOptions}
              getTagValueOptions={getTagValueOptions}
              onChange={handleTagsSectionChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {!hideLimit && (
        <InlineFieldRow>
          <InlineField label="Limit" labelWidth={labelWidth}>
            <Input placeholder="(optional)" type="number" onBlur={onLimitChange} defaultValue={state.Limit} />
          </InlineField>
        </InlineFieldRow>
      )}
      {!hideAdvancedOptions && (
        <CollapsableSection label="Advanced options" isOpen={false}>
          <InlineFieldRow>
            <InlineField
              label="Include last known point"
              tooltip="Includes the last known point before the selected time range"
              labelWidth={labelWidth}
            >
              <InlineSwitch value={state.IncludeLastKnownPoint} onChange={onChangeIncludeLastKnownPoint} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Fill empty initial intervals" labelWidth={labelWidth}>
              <InlineSwitch value={state.FillInitialEmptyValues} onChange={onChangeFillInitialEmptyValues} />
            </InlineField>
          </InlineFieldRow>
          {!appIsAlertingType && (
            <InlineFieldRow>
              <InlineField label="Use engineering specs" labelWidth={labelWidth}>
                <InlineSwitch value={state.UseEngineeringSpecs} onChange={onChangeUseEngineeringSpecs} />
              </InlineField>
            </InlineFieldRow>
          )}
          <InlineFieldRow>
            <InlineField label="Display database name" labelWidth={labelWidth}>
              <InlineSwitch value={state.DisplayDatabaseName} onChange={onChangeDisplayDatabaseName} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Display description" labelWidth={labelWidth}>
              <InlineSwitch value={state.DisplayDescription} onChange={onChangeDisplayDescription} />
            </InlineField>
          </InlineFieldRow>
        </CollapsableSection>
      )}
    </>
  )
}
