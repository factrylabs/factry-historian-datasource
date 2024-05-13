import React, { ChangeEvent, useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { CollapsableSection, InlineField, InlineFieldRow, InlineLabel, InlineSwitch, Input, Select } from '@grafana/ui'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { GroupBySection } from 'components/GroupBySection/GroupBySection'
import { getAggregationsForDatatypes, getFillTypes, getPeriods, useDebounce } from './util'
import { Aggregation, Attributes, labelWidth, MeasurementQueryOptions } from 'types'

export interface Props {
  state: MeasurementQueryOptions
  seriesLimit: number
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
  onChangeSeriesLimit: (value: number) => void
}

export const QueryOptions = (props: Props): JSX.Element => {
  const [periods, setPeriods] = useState(getPeriods())
  const [seriesLimit, setSeriesLimit] = useDebounce<number>(props.seriesLimit, 500, props.onChangeSeriesLimit)

  const getAggregationOptions = (
    datatypes: string[],
    options: MeasurementQueryOptions
  ): Array<SelectableValue<string>> => {
    const validAggregations = getAggregationsForDatatypes(datatypes)
    if (options.Aggregation?.Name !== 'last' && !validAggregations.find((e) => options.Aggregation?.Name === e.value)) {
      props.onChange(
        {
          ...props.state,
          Aggregation: {
            ...props.state.Aggregation,
            Name: 'last',
          },
        },
        props.tags
      )
    }
    return validAggregations.concat(props.templateVariables)
  }

  const onAggregationChange = (event: SelectableValue<string>) => {
    let aggregation = undefined
    if (event?.value) {
      aggregation = {
        ...props.state.Aggregation,
        Name: event.value,
        Period: props.state.Aggregation?.Period || '$__interval',
      } as Aggregation
    }
    props.onChange({ ...props.state, Aggregation: aggregation }, props.tags)
  }

  const handleTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const tags: Attributes = {}
    updatedTags.forEach((tag) => {
      tags[tag.key] = tag.value
    })
    props.onChange({ ...props.state, Tags: tags }, updatedTags)
  }

  const onGroupByChange = (groups: string[]): void => {
    props.onChange({ ...props.state, GroupBy: groups }, props.tags)
  }

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    props.onChange({ ...props.state, Limit: event.target.valueAsNumber }, props.tags)
  }

  const onPeriodChange = (selected: SelectableValue<string>): void => {
    if (selected.value) {
      const aggregation = {
        ...props.state.Aggregation,
        Period: selected.value,
      } as Aggregation
      props.onChange({ ...props.state, Aggregation: aggregation }, props.tags)
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
      ...props.state.Aggregation,
      Fill: selected?.value,
    } as Aggregation

    props.onChange({ ...props.state, Aggregation: aggregation }, props.tags)
  }

  const onChangeIncludeLastKnownPoint = (e: any): void => {
    props.onChange({ ...props.state, IncludeLastKnownPoint: e.target.checked }, props.tags)
  }

  const onChangeFillInitialEmptyValues = (e: any): void => {
    props.onChange({ ...props.state, FillInitialEmptyValues: e.target.checked }, props.tags)
  }

  const onChangeUseEngineeringSpecs = (e: any): void => {
    props.onChange({ ...props.state, UseEngineeringSpecs: e.target.checked }, props.tags)
  }

  const onChangeDisplayDatabaseName = (e: any): void => {
    props.onChange({ ...props.state, DisplayDatabaseName: e.target.checked }, props.tags)
  }

  const onChangeDisplayDescription = (e: any): void => {
    props.onChange({ ...props.state, DisplayDescription: e.target.checked }, props.tags)
  }

  const onChangeMetadataAsLabels = (e: any): void => {
    props.onChange({ ...props.state, MetadataAsLabels: e.target.checked }, props.tags)
  }

  const onChangeSeriesLimit = (event: ChangeEvent<HTMLInputElement>): void => {
    setSeriesLimit(Number(event.target.value))
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
            value={props.state.Aggregation?.Name}
            placeholder="select an aggregation"
            isClearable
            options={getAggregationOptions(props.datatypes, props.state)}
            onChange={onAggregationChange}
          />
        </InlineField>
        {!props.hideInterval && props.state.Aggregation?.Name && (
          <InlineField>
            <Select
              value={props.state.Aggregation?.Period}
              options={periods.concat(props.templateVariables)}
              allowCustomValue
              onChange={onPeriodChange}
              onCreateOption={onCreatePeriod}
            />
          </InlineField>
        )}
        {!props.hideFill && props.state.Aggregation?.Name && (
          <InlineField>
            <Select
              value={props.state.Aggregation?.Fill}
              placeholder="(optional) select a fill type"
              options={getFillTypes().concat(props.templateVariables)}
              onChange={onFillChange}
              isClearable
            />
          </InlineField>
        )}
      </InlineFieldRow>
      {!props.hideGroupBy && (
        <InlineFieldRow>
          <InlineLabel width={labelWidth} tooltip="Add all tags to group by">
            Group by
          </InlineLabel>
          <GroupBySection
            getTagKeyOptions={props.getTagKeyOptions}
            groups={props.state.GroupBy || []}
            onChange={onGroupByChange}
          />
        </InlineFieldRow>
      )}
      {!props.hideTagFilter && (
        <InlineFieldRow>
          <InlineField label="Filter tags" labelWidth={labelWidth}>
            <TagsSection
              tags={props.tags}
              conditions={['AND']}
              getTagKeyOptions={props.getTagKeyOptions}
              getTagValueOptions={props.getTagValueOptions}
              onChange={handleTagsSectionChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {!props.hideLimit && (
        <InlineFieldRow>
          <InlineField label="Limit" labelWidth={labelWidth}>
            <Input placeholder="(optional)" type="number" onBlur={onLimitChange} defaultValue={props.state.Limit} />
          </InlineField>
        </InlineFieldRow>
      )}
      {!props.hideAdvancedOptions && (
        <CollapsableSection label="Advanced options" isOpen={false}>
          <InlineFieldRow>
            <InlineField
              label="Include last known point"
              tooltip="Includes the last known point before the selected time range"
              labelWidth={labelWidth}
            >
              <InlineSwitch value={props.state.IncludeLastKnownPoint} onChange={onChangeIncludeLastKnownPoint} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Fill empty initial intervals" labelWidth={labelWidth}>
              <InlineSwitch value={props.state.FillInitialEmptyValues} onChange={onChangeFillInitialEmptyValues} />
            </InlineField>
          </InlineFieldRow>
          {!props.appIsAlertingType && (
            <InlineFieldRow>
              <InlineField label="Use engineering specs" labelWidth={labelWidth}>
                <InlineSwitch value={props.state.UseEngineeringSpecs} onChange={onChangeUseEngineeringSpecs} />
              </InlineField>
            </InlineFieldRow>
          )}
          <InlineFieldRow>
            <InlineField label="Display database name" labelWidth={labelWidth}>
              <InlineSwitch value={props.state.DisplayDatabaseName} onChange={onChangeDisplayDatabaseName} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Display description" labelWidth={labelWidth}>
              <InlineSwitch value={props.state.DisplayDescription} onChange={onChangeDisplayDescription} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Add metadata as labels"
              labelWidth={labelWidth}
              tooltip="Adds metadata such as MeasurementUUID and DatabaseUUID as labels to the query result"
            >
              <InlineSwitch value={props.state.MetadataAsLabels} onChange={onChangeMetadataAsLabels} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Measurement limit"
              tooltip="The maximum amount of measurement series a query can return"
              labelWidth={labelWidth}
            >
              <Input value={seriesLimit} type="number" min={1} onChange={onChangeSeriesLimit} />
            </InlineField>
          </InlineFieldRow>
        </CollapsableSection>
      )}
    </>
  )
}
