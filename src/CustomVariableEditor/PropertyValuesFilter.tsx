import React, { useEffect, useState } from 'react'

import { DataSource } from 'datasource'
import {
  Asset,
  EventConfiguration,
  EventPropertyFilter,
  EventType,
  EventTypePropertiesValuesFilter,
  EventTypeProperty,
  HistorianInfo,
  labelWidth,
  PropertyDatatype,
  PropertyType,
} from 'types'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, MultiSelect, Select } from '@grafana/ui'
import Cascader from 'components/Cascader/Cascader'
import { getChildAssets, matchedAssets, propertyFilterToQueryTags } from 'QueryEditor/util'
import { toSelectableValue } from 'components/TagsSection/util'
import { TagsSection } from 'components/TagsSection/TagsSection'
import { QueryTag } from 'components/TagsSection/types'
import { getValueFilterOperatorsForVersion, operatorsWithoutValue } from 'util/eventFilter'

export function PropertyValuesFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypePropertiesValuesFilter) => void
  initialValue?: EventTypePropertiesValuesFilter
  templateVariables: Array<SelectableValue<string>>
  historianInfo: HistorianInfo | undefined
}) {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [eventTypeProperties, setEventTypeProperties] = useState<EventTypeProperty[]>([])
  const [eventConfigurations, setEventConfigurations] = useState<EventConfiguration[]>([])
  const assetOptions = getChildAssets(null, assets).concat(
    props.templateVariables.map((e) => {
      return { label: `${e.label}`, value: `${e.value}` }
    })
  )

  useEffect(() => {
    const load = async () => {
      const assets = await props.datasource.getAssets()
      setAssets(assets)
      const eventTypes = await props.datasource.getEventTypes()
      setEventTypes(eventTypes)
      const eventTypeProperties = await props.datasource.getEventTypeProperties()
      setEventTypeProperties(eventTypeProperties)
      const eventConfigurations = await props.datasource.getEventConfigurations()
      setEventConfigurations(eventConfigurations)
      setLoading(false)
    }
    if (loading) {
      load()
    }
  }, [loading, props.datasource])

  const onAssetChange = (value: string): void => {
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        Assets: [value],
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onSelectEventTypes = (items: Array<SelectableValue<string>>): void => {
    const selectedEventTypes = items.map((e) => {
      const eventType = eventTypes.find((et) => et.Name === e.value)
      if (eventType) {
        return eventType.UUID
      }

      return e.value || ''
    })

    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        EventTypes: selectedEventTypes,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onSelectProperties = (item: SelectableValue<string>): void => {
    const selectedProperty = props.datasource.replace(item.value, props.initialValue?.ScopedVars)
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
        Properties: [item.value || ''],
      },
      EventTypePropertyUUID: eventTypeProperty?.UUID,
      HistorianInfo: props.historianInfo,
    })
  }

  const onSelectStatuses = (items: Array<SelectableValue<string>>): void => {
    const statuses = items.map((e) => {
      return e.value || ''
    })
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        Statuses: statuses,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const onTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const filter: EventPropertyFilter[] = []
    updatedTags.forEach((tag) => {
      const dataType = getDatatype(tag.key)
      let eventPropertyFilter: EventPropertyFilter = {
        Property: tag.key,
        Datatype: dataType,
        Condition: tag.condition || '',
        Operator: tag.operator || '=',
      }
      if (!operatorsWithoutValue.includes(tag.operator as any)) {
        eventPropertyFilter.Value = tag.value
      }
      filter.push(eventPropertyFilter)
    })
    props.onChange({
      ...props.initialValue,
      EventFilter: {
        ...props.initialValue?.EventFilter!,
        PropertyFilter: filter,
      },
      HistorianInfo: props.historianInfo,
    })
  }

  const getDatatype = (property: string): PropertyDatatype => {
    const datatype = eventTypeProperties
      .filter((e) => props.initialValue?.EventFilter.EventTypes?.includes(e.EventTypeUUID))
      .find((e) => e.Name === property)?.Datatype

    if (!datatype) {
      return PropertyDatatype.Number
    }

    return datatype
  }

  const initialLabel = (): string => {
    const selectedAssets = props.initialValue?.EventFilter?.Assets
    if (!selectedAssets || selectedAssets.length === 0) {
      return ''
    }

    const asset = assets.find((e) => e.UUID === selectedAssets[0])
    if (asset) {
      return asset.AssetPath || ''
    }

    return selectedAssets[0]
  }

  const getSelectedAssets = (selected: string | undefined, assets: Asset[]): Asset[] => {
    const replacedAssets = props.datasource.multiSelectReplace(selected, {})
    return matchedAssets(replacedAssets, assets)
  }

  const availableEventTypes = (selected: string | undefined): Array<SelectableValue<string>> => {
    const selectedAssets = getSelectedAssets(selected, assets)
    return eventTypes
      .filter((e) =>
        eventConfigurations.some(
          (ec) => selectedAssets.find((a) => a.UUID === ec.AssetUUID) && ec.EventTypeUUID === e.UUID
        )
      )
      .map((e) => {
        return { label: e.Name, value: e.UUID }
      })
      .concat(
        props.templateVariables.map((e) => {
          return { label: `${e.label}`, value: `${e.value}` }
        })
      )
  }

  const availableSimpleProperties = (eventTypes: string[]): string[] => {
    const selectedEventTypes = eventTypes.flatMap((e) => props.datasource.multiSelectReplace(e))
    return [
      ...new Set(
        eventTypeProperties
          .filter((e) => e.Type === PropertyType.Simple)
          .filter((e) => selectedEventTypes.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const availableProperties = (eventTypes: string[]): Array<SelectableValue<string>> => {
    let properties = availableSimpleProperties(eventTypes)

    return properties
      .map((e) => {
        return { label: e, value: e }
      })
      .concat(
        props.templateVariables.map((e) => {
          return { label: `${e.label}`, value: `${e.value}` }
        })
      )
  }

  const availableStatuses = (): Array<SelectableValue<string>> => {
    return [
      toSelectableValue('processed'),
      toSelectableValue('open'),
      toSelectableValue('incomplete'),
      toSelectableValue('pending'),
    ].concat(props.templateVariables)
  }

  const availablePropertyValues = (key: string): string[] => {
    const eventTypeProperty = eventTypeProperties
      .filter((e) => props.initialValue?.EventFilter.EventTypes?.includes(e.EventTypeUUID))
      .find((e) => e.Name === key)

    if (!eventTypeProperty) {
      return []
    }

    if (eventTypeProperty.Datatype !== PropertyDatatype.Bool) {
      return []
    }

    return ['true', 'false']
  }

  return loading ? (
    <></>
  ) : (
    <>
      <InlineFieldRow>
        <InlineField label="Assets" grow labelWidth={labelWidth} tooltip="Specify an asset to work with">
          <Cascader
            initialValue={
              props.initialValue?.EventFilter.Assets?.length ? props.initialValue?.EventFilter.Assets[0] : ''
            }
            initialLabel={initialLabel()}
            options={assetOptions}
            displayAllSelectedLevels
            onSelect={onAssetChange}
            separator="\\"
          />
        </InlineField>
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField
          label="Event types"
          grow
          labelWidth={labelWidth}
          tooltip="Specify one or more event type to work with"
        >
          <MultiSelect
            value={props.initialValue?.EventFilter.EventTypes}
            options={availableEventTypes(
              props.initialValue?.EventFilter.Assets?.length ? props.initialValue?.EventFilter.Assets[0] : ''
            )}
            onChange={onSelectEventTypes}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Property" grow labelWidth={labelWidth} tooltip="Specify the property to include">
          <Select
            value={
              props.initialValue?.EventFilter.Properties?.length ? props.initialValue?.EventFilter.Properties[0] : ''
            }
            options={availableProperties(props.initialValue?.EventFilter.EventTypes ?? [])}
            onChange={onSelectProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Statuses"
          grow
          labelWidth={labelWidth}
          tooltip="Specify one or more status to work with, selecting none will use all statuses"
        >
          <MultiSelect
            value={props.initialValue?.EventFilter.Statuses}
            options={availableStatuses()}
            onChange={onSelectStatuses}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="WHERE" labelWidth={labelWidth}>
          <TagsSection
            tags={propertyFilterToQueryTags(props.initialValue?.EventFilter.PropertyFilter ?? [])}
            operators={getValueFilterOperatorsForVersion(props.historianInfo?.Version ?? '')}
            getTagKeyOptions={() =>
              Promise.resolve(availableSimpleProperties(props.initialValue?.EventFilter.EventTypes ?? []))
            }
            getTagValueOptions={(key) => Promise.resolve(availablePropertyValues(key))}
            onChange={onTagsSectionChange}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
