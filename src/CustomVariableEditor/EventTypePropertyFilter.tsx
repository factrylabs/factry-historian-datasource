import React, { useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { DataSource } from 'datasource'
import { EventTypeFilter, EventTypePropertiesFilter, EventTypePropertyType, labelWidth } from 'types'

export function EventTypePropertyFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypePropertiesFilter) => void
  initialValue?: EventTypePropertiesFilter
  templateVariables: SelectableValue<string>
}) {
  const [selectedEventTypes, setEventTypes] = useState<Array<SelectableValue<string>>>()

  const onEventTypesChange = (values: Array<SelectableValue<string>>) => {
    props.onChange({
      ...props.initialValue,
      EventTypeUUIDs: values.map((e) => e.value ?? ''),
    })
    setEventTypes(values)
  }

  const loadEventTypeOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: EventTypeFilter = {
      Keyword: query,
    }
    const eventTypes = await props.datasource.getEventTypes(filter)
    const selectableValues = eventTypes
      .map((e) => {
        return {
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!selectedEventTypes) {
      setEventTypes(selectableValues.filter((e) => props.initialValue?.EventTypeUUIDs?.includes(e.value ?? '')))
    }
    return selectableValues
  }

  const onTypeChange = (value: SelectableValue<string> | undefined) => {
    props.onChange({
      ...props.initialValue,
      Types: value?.value ? [value.value] : [],
    })
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Filter by event types'} aria-label={'Filter by event types'} labelWidth={labelWidth}>
          <AsyncMultiSelect
            placeholder="Select event type(s)"
            width={25}
            onChange={(value) => onEventTypesChange(value)}
            defaultOptions
            loadOptions={loadEventTypeOptions}
            value={selectedEventTypes}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label={'Property types'} aria-label={'Property types'} labelWidth={labelWidth}>
          <Select
            placeholder="Select property type"
            width={25}
            onChange={(value) => onTypeChange(value)}
            options={Object.entries(EventTypePropertyType).map(([key, value]) => {
              return { label: key, value: value as string }
            })}
            isClearable
            value={props.initialValue?.Types}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
