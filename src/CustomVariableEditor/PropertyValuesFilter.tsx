import React, { ChangeEvent, useCallback, useEffect, useState } from 'react'

import { DataSource } from 'datasource'
import {
  EventQuery,
  EventTypePropertiesValuesFilter,
  EventTypeProperty,
  HistorianInfo,
  PropertyType,
  TimeRange,
  labelWidth,
} from 'types'
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
  const [loading, setLoading] = useState(true)
  const [eventTypeProperties, setEventTypeProperties] = useState<EventTypeProperty[]>([])

  const fetchAll = useCallback(async () => {
    const eventTypeProperties = await props.datasource.getEventTypeProperties()
    setEventTypeProperties(eventTypeProperties)
  }, [props.datasource])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        await fetchAll()
        setLoading(false)
      })()
    }
  }, [loading, fetchAll])

  const onChangeEventFilter = (query: EventQuery) => {
    const property = query.Properties?.length ? query.Properties[0] : ''
    const selectedProperty = props.datasource.replace(property, props.initialValue?.ScopedVars)
    const eventTypeProperty = eventTypeProperties.find(
      (e) =>
        (e.Name === selectedProperty || e.UUID === selectedProperty) &&
        e.Type === PropertyType.Simple &&
        props.initialValue?.EventFilter.EventTypes?.includes(e.EventTypeUUID)
    )
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        ...query,
      },
      HistorianInfo: props.historianInfo,
      EventTypePropertyUUID: eventTypeProperty?.UUID,
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

  return loading || !props.initialValue ? (
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
