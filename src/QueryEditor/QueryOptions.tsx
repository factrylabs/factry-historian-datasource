import React, { ChangeEvent, useState, useEffect } from 'react'
import { SelectableValue } from '@grafana/data'
import {
  Checkbox,
  ControlledCollapse,
  HorizontalGroup,
  VerticalGroup,
  InlineField,
  InlineFieldRow,
  InlineLabel,
  InlineSwitch,
  Input,
  MultiSelect,
  Select,
} from '@grafana/ui'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { GroupBySection } from 'components/GroupBySection/GroupBySection'
import { getAggregationsForVersionAndDatatypes, getFillTypes, getPeriods, useDebounce } from './util'
import {
  Aggregation,
  Attributes,
  fieldWidth,
  labelWidth,
  MeasurementDatatype,
  MeasurementQueryOptions,
  ValueFilter,
} from 'types'
import { isFeatureEnabled } from 'util/semver'

export interface Props {
  state: MeasurementQueryOptions
  seriesLimit: number
  tags: QueryTag[]
  valueFilters: QueryTag[]
  appIsAlertingType: boolean
  datatypes: string[]
  hideInterval?: boolean
  hideFill?: boolean
  hideLimit?: boolean
  hideGroupBy?: boolean
  hideTagFilter?: boolean
  hideAdvancedOptions?: boolean
  hideDatatypeFilter?: boolean
  aggregationRequired?: boolean
  templateVariables: Array<SelectableValue<string>>
  historianVersion: string
  getTagKeyOptions?: () => Promise<string[]>
  getTagValueOptions?: (key: string) => Promise<string[]>
  onChange: (options: MeasurementQueryOptions) => void
  onChangeSeriesLimit: (value: number) => void
}

const datatypeOptions: Array<SelectableValue<string>> = Object.entries(MeasurementDatatype).map(([_, value]) => {
  return { label: value, value: value }
})

export const QueryOptions = (props: Props): JSX.Element => {
  const [periods, setPeriods] = useState(getPeriods())
  const [seriesLimit, setSeriesLimit] = useDebounce<number>(props.seriesLimit, 500, props.onChangeSeriesLimit)

  useEffect(() => {
    if (props.state.Aggregation?.Period) {
      const periodExists = periods.some((period) => period.value === props.state.Aggregation?.Period)

      if (!periodExists) {
        const customValue: SelectableValue<string> = {
          value: props.state.Aggregation?.Period,
          label: props.state.Aggregation?.Period,
        }
        setPeriods((prevPeriods) => [...prevPeriods, customValue])
      }
    }
  }, [periods, props.state.Aggregation?.Period])

  const getAggregationOptions = (
    datatypes: string[],
    options: MeasurementQueryOptions
  ): Array<SelectableValue<string>> => {
    const validAggregations = getAggregationsForVersionAndDatatypes(datatypes, props.historianVersion)
    if (
      options.Aggregation?.Name !== undefined &&
      options.Aggregation?.Name !== 'last' &&
      !validAggregations.find((e) => options.Aggregation?.Name === e.value)
    ) {
      props.onChange({
        ...props.state,
        Aggregation: {
          ...props.state.Aggregation,
          Name: 'last',
        },
      })
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
    props.onChange({ ...props.state, Aggregation: aggregation })
  }

  const handleTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const tags: Attributes = {}
    updatedTags.forEach((tag) => {
      tags[tag.key] = tag.value
    })
    props.onChange({ ...props.state, Tags: tags })
  }

  const handleFilterByValueChange = (updatedValues: QueryTag[]): void => {
    const valueFilters: ValueFilter[] = updatedValues.map((value) => {
      return {
        Value: value.value,
        Operator: value.operator,
        Condition: value.condition,
      } as ValueFilter
    })
    props.onChange({ ...props.state, ValueFilters: valueFilters })
  }

  const onGroupByChange = (groups: string[]): void => {
    props.onChange({ ...props.state, GroupBy: groups })
  }

  const onLimitChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    props.onChange({ ...props.state, Limit: event.target.valueAsNumber })
  }

  const onPeriodChange = (selected: SelectableValue<string>): void => {
    let aggregation = { ...props.state.Aggregation } as Aggregation
    if (selected?.value) {
      aggregation.Period = selected.value
    } else {
      delete aggregation.Period
      delete aggregation.Fill
    }
    props.onChange({ ...props.state, Aggregation: aggregation })
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

    props.onChange({ ...props.state, Aggregation: aggregation })
  }

  const onChangeIncludeLastKnownPoint = (e: any): void => {
    props.onChange({ ...props.state, IncludeLastKnownPoint: e.target.checked })
  }

  const onChangeFillInitialEmptyValues = (e: any): void => {
    props.onChange({ ...props.state, FillInitialEmptyValues: e.target.checked })
  }

  const onChangeChangesOnly = (e: any): void => {
    const updatedState = { ...props.state, ChangesOnly: e.target.checked }
    if (props.state.FillInitialEmptyValues && e.target.checked) {
      updatedState.FillInitialEmptyValues = false
    }
    props.onChange(updatedState)
  }

  const onChangeUseEngineeringSpecs = (e: any): void => {
    props.onChange({ ...props.state, UseEngineeringSpecs: e.target.checked })
  }

  const onChangeDisplayDatabaseName = (e: any): void => {
    props.onChange({ ...props.state, DisplayDatabaseName: e.target.checked })
  }

  const onChangeDisplayDescription = (e: any): void => {
    props.onChange({ ...props.state, DisplayDescription: e.target.checked })
  }

  const onChangeMetadataAsLabels = (e: any): void => {
    props.onChange({ ...props.state, MetadataAsLabels: e.target.checked })
  }

  const onChangeSeriesLimit = (event: ChangeEvent<HTMLInputElement>): void => {
    setSeriesLimit(Number(event.target.value))
  }

  const onChangeDatatypes = (selected: Array<SelectableValue<string>>): void => {
    if (!selected) {
      props.onChange({ ...props.state, Datatypes: [] })
    } else {
      const selectedDatatypes = selected.map((e) => e.value ?? '')
      props.onChange({ ...props.state, Datatypes: selectedDatatypes })
    }
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Aggregation"
          labelWidth={labelWidth}
          tooltip={`Specify an aggregation and an interval to fetch an aggregated measurement value for each interval${
            props.aggregationRequired ? '' : ', remove both to fetch raw data'
          }`}
        >
          <VerticalGroup spacing="xs">
            <HorizontalGroup spacing="xs">
              <InlineField>
                <Select
                  value={props.state.Aggregation?.Name}
                  placeholder="select an aggregation"
                  isClearable={!props.aggregationRequired}
                  options={getAggregationOptions(props.datatypes, props.state)}
                  onChange={onAggregationChange}
                  width={fieldWidth}
                />
              </InlineField>
              {!props.hideInterval && props.state.Aggregation?.Name && (
                <InlineField>
                  <Select
                    placeholder="period"
                    value={props.state.Aggregation?.Period}
                    options={periods.concat(props.templateVariables)}
                    allowCustomValue
                    onChange={onPeriodChange}
                    onCreateOption={onCreatePeriod}
                    isClearable
                    width={fieldWidth}
                  />
                </InlineField>
              )}
              {!props.hideFill && props.state.Aggregation?.Period && (
                <InlineField>
                  <Select
                    value={props.state.Aggregation?.Fill}
                    placeholder="Fill type"
                    options={getFillTypes().concat(props.templateVariables)}
                    onChange={onFillChange}
                    isClearable
                    width={fieldWidth}
                  />
                </InlineField>
              )}
            </HorizontalGroup>

            <HorizontalGroup>
              {props.state.Aggregation?.Period && (
                <InlineField>
                  <Checkbox
                    label="Fill empty initial intervals"
                    value={props.state.FillInitialEmptyValues}
                    onChange={onChangeFillInitialEmptyValues}
                  />
                </InlineField>
              )}
              <InlineField tooltip="Includes the last known value before the selected time range">
                <Checkbox
                  label="Include last known point"
                  value={props.state.IncludeLastKnownPoint}
                  onChange={onChangeIncludeLastKnownPoint}
                />
              </InlineField>
            </HorizontalGroup>
          </VerticalGroup>
        </InlineField>
      </InlineFieldRow>
      {!props.hideGroupBy && (
        <InlineFieldRow>
          <InlineLabel width={labelWidth} tooltip="Group values per tag (e.g. status)">
            Group by
          </InlineLabel>
          <GroupBySection
            getTagKeyOptions={props.getTagKeyOptions}
            groups={props.state.GroupBy || []}
            onChange={onGroupByChange}
          />
        </InlineFieldRow>
      )}
      {!props.hideDatatypeFilter && (
        <InlineFieldRow>
          <InlineField label="Filter datatypes" labelWidth={labelWidth}>
            <MultiSelect
              value={props.state.Datatypes}
              placeholder="all datatypes"
              options={datatypeOptions}
              onChange={onChangeDatatypes}
              isClearable
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {!props.hideTagFilter && (
        <InlineFieldRow>
          <InlineField
            label="Filter tags"
            tooltip="Filter values by one or more tag conditions (e.g. status = Good)"
            labelWidth={labelWidth}
          >
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
      {isFeatureEnabled(props.historianVersion, '7.1.0') && (
        <InlineFieldRow>
          <InlineField
            label="Filter values"
            tooltip="Filter values by one or more conditions (e.g. value > 0)"
            labelWidth={labelWidth}
          >
            <TagsSection
              tags={props.valueFilters}
              conditions={['AND', 'OR']}
              operators={['=', '!=', '>', '>=', '<', '<=']}
              placeholder="enter a value"
              getTagKeyOptions={() => Promise.resolve(['value'])}
              getTagValueOptions={() => Promise.resolve([''])}
              onChange={handleFilterByValueChange}
            />
          </InlineField>
        </InlineFieldRow>
      )}
      {!props.hideLimit && (
        <InlineFieldRow>
          <InlineField
            label="Max values"
            tooltip="The maximum amount of values to fetch per measurement"
            labelWidth={labelWidth}
          >
            <Input placeholder="(optional)" type="number" onBlur={onLimitChange} defaultValue={props.state.Limit} />
          </InlineField>
        </InlineFieldRow>
      )}
      {!props.hideAdvancedOptions && (
        <>
          <br />
          <ControlledCollapse label="Advanced options" isOpen={false}>
            <InlineFieldRow>
              <InlineField
                label="Changes only"
                tooltip="Hide equal consecutive values (keeps the first value) within the selected time range"
                labelWidth={labelWidth}
              >
                <InlineSwitch value={props.state.ChangesOnly} onChange={onChangeChangesOnly} />
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
                label="Max Measurements"
                tooltip="The maximum amount of measurements to fetch"
                labelWidth={labelWidth}
              >
                <Input value={seriesLimit} type="number" min={0} onChange={onChangeSeriesLimit} />
              </InlineField>
            </InlineFieldRow>
          </ControlledCollapse>
        </>
      )}
    </>
  )
}
