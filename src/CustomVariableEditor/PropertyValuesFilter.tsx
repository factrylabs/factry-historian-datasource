import React, { useCallback, useEffect, useState } from 'react'

import { DataSource } from 'datasource'
import {
  EventPropertyFilter,
  EventTypePropertiesValuesFilter,
  EventTypeProperty,
  HistorianInfo,
  PropertyType,
} from 'types'
import { SelectableValue } from '@grafana/data'
import { EventFilter } from 'QueryEditor/EventFilter'

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

  const onChangeAssets = (assets: string[]) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        Assets: assets,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onChangeEventTypes = (eventTypes: string[]) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        EventTypes: eventTypes,
      },
      HistorianInfo: props.historianInfo,
    })
  }
  const onChangeProperties = (properties: string[]) => {
    const property = properties.length ? properties[0] : ''
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
        Properties: properties,
      },
      HistorianInfo: props.historianInfo,
      EventTypePropertyUUID: eventTypeProperty?.UUID,
    })
  }

  const onChangeStatuses = (statuses: string[]) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        Statuses: statuses,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onChangeQueryType = (queryType: PropertyType) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        Type: queryType,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onChangeEventPropertyFilter = (propertyFilter: EventPropertyFilter[]) => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        PropertyFilter: propertyFilter,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  return loading || !props.initialValue ? (
    <></>
  ) : (
    <EventFilter
      datasource={props.datasource}
      query={props.initialValue?.EventFilter}
      isAnnotationQuery={false}
      multiSelectProperties={false}
      onChangeAssets={onChangeAssets}
      onChangeEventPropertyFilter={onChangeEventPropertyFilter}
      onChangeEventTypes={onChangeEventTypes}
      onChangeProperties={onChangeProperties}
      onChangeStatuses={onChangeStatuses}
      onChangeQueryType={onChangeQueryType}
    />
  )
}
