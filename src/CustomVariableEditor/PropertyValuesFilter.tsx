import React, { ChangeEvent } from 'react'

import { DataSource } from 'datasource'
import { EventQuery, EventTypePropertiesValuesFilter, HistorianInfo, TimeRange, labelWidth } from 'types'
import { SelectableValue } from '@grafana/data'
import { EventFilter } from 'QueryEditor/EventFilter'
import { InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui'
import { DateRangePicker } from 'components/util/DateRangePicker'

export function PropertyValuesFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypePropertiesValuesFilter) => void
  initialValue?: EventTypePropertiesValuesFilter
  templateVariables: Array<SelectableValue<string>>
  historianInfo: HistorianInfo | undefined
}) {
  const onChangeEventFilter = (query: EventQuery) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        ...query,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onChangeTimeRange = (value: TimeRange): void => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        TimeRange: value,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onChangeOverrideTimeRange = (event: ChangeEvent<HTMLInputElement>): void => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        OverrideTimeRange: event.target.checked,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  return !props.initialValue ? (
    <></>
  ) : (
    <>
      <EventFilter
        datasource={props.datasource}
        query={props.initialValue?.EventFilter}
        isAnnotationQuery={false}
        multiSelectProperties={false}
        onChangeQuery={onChangeEventFilter}
      />

      <InlineFieldRow>
        <InlineField label="Override time range" labelWidth={labelWidth}>
          <div>
            <InlineSwitch
              label="Override time range"
              value={props.initialValue?.EventFilter.OverrideTimeRange}
              onChange={onChangeOverrideTimeRange}
            />
          </div>
        </InlineField>
      </InlineFieldRow>
      {props.initialValue?.EventFilter.OverrideTimeRange && (
        <DateRangePicker
          override={props.initialValue?.EventFilter.OverrideTimeRange}
          dateTimeRange={props.initialValue?.EventFilter.TimeRange}
          onChange={onChangeTimeRange}
          datasource={props.datasource}
        />
      )}
    </>
  )
}
