import React, { useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { DataSource } from 'datasource'
import { EventTypeFilter, EventTypePropertiesFilter, EventTypePropertyType } from 'types'
import { SelectableValue } from '@grafana/data'

export function EventTypePropertyFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypePropertiesFilter) => void
  initialValue?: EventTypePropertiesFilter
  templateVariables: SelectableValue<string>
}) {
  const [selectedEventTypes, setEventTypes] = useState<Array<SelectableValue<string>>>()
  let initialLoadDone = false

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
    const assets = await props.datasource.getEventTypes(filter)
    const selectableValues = assets
      .map((e) => {
        return {
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!initialLoadDone) {
      setEventTypes(selectableValues.filter((e) => props.initialValue?.EventTypeUUIDs?.includes(e.value ?? '')))
      initialLoadDone = true
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
        <InlineField
          label={'Event types'}
          aria-label={'Event types'}
          labelWidth={20}
          tooltip={<div>Searches event types by name, to use a regex surround pattern with /</div>}
        >
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
        <InlineField
          label={'Event types'}
          aria-label={'Event types'}
          labelWidth={20}
          tooltip={<div>Searches event types by name, to use a regex surround pattern with /</div>}
        >
          <Select
            placeholder="Select type"
            width={25}
            onChange={(value) => onTypeChange(value)}
            options={Object.entries(EventTypePropertyType).map(([key, value]) => {
              return { label: key, value: value as string }
            })}
            isClearable
            value={selectedEventTypes}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
