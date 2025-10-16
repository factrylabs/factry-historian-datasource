import React, { useCallback, useEffect, useState } from 'react'
import { InlineField, InlineFieldRow, MultiSelect, Select } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { default as Cascader } from 'components/Cascader/Cascader'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { toSelectableValue } from 'components/TagsSection/util'
import { DataSource } from 'datasource'
import {
  Asset,
  EventConfiguration,
  EventPropertyFilter,
  EventQuery,
  EventType,
  EventTypeProperty,
  labelWidth,
  PropertyDatatype,
  PropertyType,
} from 'types'
import { getValueFilterOperatorsForVersion, KnownOperator, needsValue } from 'util/eventFilter'
import { getChildAssets, isSupportedPropertyType, matchedAssets, propertyFilterToQueryTags } from './util'
import { isFeatureEnabled } from 'util/semver'
import { isRegex, isUUID } from 'util/util'

export interface Props {
  query: EventQuery
  datasource: DataSource
  isAnnotationQuery?: boolean
  multiSelectProperties?: boolean
  onChangeQuery: (query: EventQuery) => void
}

export const EventFilter = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [eventTypeProperties, setEventTypeProperties] = useState<EventTypeProperty[]>([])
  const [eventConfigurations, setEventConfigurations] = useState<EventConfiguration[]>([])
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })
  const assetOptions = getChildAssets(null, assets).concat(templateVariables)

  const fetchAll = useCallback(async () => {
    const assets = await props.datasource.getAssets()
    setAssets(assets)
    const eventTypes = await props.datasource.getEventTypes()
    setEventTypes(eventTypes)
    const eventTypeProperties = await props.datasource.getEventTypeProperties()
    setEventTypeProperties(eventTypeProperties)
    const eventConfigurations = await props.datasource.getEventConfigurations()
    setEventConfigurations(eventConfigurations)
  }, [props.datasource])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        await fetchAll()
        setLoading(false)
      })()
    }
  }, [loading, fetchAll])

  const getSelectedAssets = (selected: string | undefined, assets: Asset[]): Asset[] => {
    const replacedAssets = props.datasource.multiSelectReplace(selected, {})
    return matchedAssets(replacedAssets, assets)
  }

  const availableEventTypes = (selectedAsset: string | undefined): Array<SelectableValue<string>> => {
    const selectedAssets = getSelectedAssets(selectedAsset, assets)
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
        getTemplateSrv()
          .getVariables()
          .map((e) => {
            return { label: `$${e.name}`, value: `$${e.name}` }
          })
      )
  }

  const filterEventTypes = (selectedEventTypes: string[], asset: string): string[] => {
    const selectedAssets = getSelectedAssets(asset, assets)
    return selectedEventTypes.filter((et) => {
      // if there is a templated event type selected, we don't filter any out
      if (props.datasource.containsTemplate(et)) {
        return true
      }

      return eventConfigurations.some(
        (ec) => selectedAssets.find((a) => a.UUID === ec.AssetUUID) && ec.EventTypeUUID === et
      )
    })
  }

  const filterProperties = (properties: string[], eventTypes: string[], includeParent: boolean): string[] => {
    const availableProps = availableProperties(eventTypes, includeParent).map((o) => o.value as string)
    return properties.filter((p) => availableProps.includes(p))
  }

  const onSelectEventTypes = (items: Array<SelectableValue<string>>): void => {
    const selectedEventTypes = items.map((e) => {
      const eventType = eventTypes.find((et) => et.Name === e.value)
      if (eventType) {
        return eventType.UUID
      }
      return e.value || ''
    })

    const filteredEventTypes = filterEventTypes(
      selectedEventTypes,
      props.query.Assets?.length ? props.query.Assets[0] : ''
    )
    const filteredProperties = filterProperties(
      props.query.Properties ?? [],
      filteredEventTypes,
      props.query.IncludeParentInfo ?? false
    )

    props.onChangeQuery({
      ...props.query,
      EventTypes: filteredEventTypes,
      Properties: filteredProperties,
    })
  }

  const onSelectStatuses = (items: Array<SelectableValue<string>>): void => {
    const statuses = items.map((e) => {
      return e.value || ''
    })

    props.onChangeQuery({
      ...props.query,
      Statuses: statuses,
    })
  }

  const onAssetChange = (value: string): void => {
    if (!isUUID(value) && !isRegex(value) && !props.datasource.containsTemplate(value)) {
      if (!props.query.Assets || props.query.Assets.length === 0) {
        return
      }

      props.onChangeQuery({
        ...props.query,
        Assets: [],
        EventTypes: [],
        Properties: [],
      })
      return
    }
    const filteredEventTypes = filterEventTypes(props.query.EventTypes ?? [], value)
    const filteredProperties = filterProperties(
      props.query.Properties ?? [],
      filteredEventTypes,
      props.query.IncludeParentInfo ?? false
    )
    props.onChangeQuery({
      ...props.query,
      Assets: [value],
      EventTypes: filteredEventTypes,
      Properties: filteredProperties,
    })
  }

  const onChangeQueryType = (item: SelectableValue<string>): void => {
    const queryType: PropertyType = item.value ? (item.value as PropertyType) : PropertyType.Simple

    const updatedQuery = {
      ...props.query,
      Type: queryType,
      Properties: filterProperties(
        props.query.Properties ?? [],
        props.query.EventTypes ?? [],
        props.query.IncludeParentInfo ?? false
      ),
    }
    props.onChangeQuery(updatedQuery)
  }

  const handleEventPropertyFilterChange = (updatedTags: QueryTag[]): void => {
    const propertyFilter: EventPropertyFilter[] = []
    updatedTags.forEach((tag) => {
      const isParent = tag.key.startsWith('parent:')
      const cleanKey = tag.key.replace('parent:', '')
      const dataType = getDatatype(cleanKey, isParent)
      const filter: EventPropertyFilter = {
        Property: tag.key,
        Datatype: dataType,
        Condition: tag.condition || '',
        Operator: tag.operator || '=',
        ScopedVars: {},
        Parent: isParent,
        ...(needsValue(tag.operator as KnownOperator) ? { Value: tag.value } : {}),
      }
      propertyFilter.push(filter)
    })
    props.onChangeQuery({
      ...props.query,
      PropertyFilter: propertyFilter,
    })
  }

  const getDatatype = (property: string, isParent: boolean): PropertyDatatype => {
    if (property === 'duration') {
      return PropertyDatatype.String
    }

    let selectedEventTypesUUIDs: string[] = []
    if (isParent) {
      selectedEventTypesUUIDs = getSelectedParentEventTypes(props.query.EventTypes ?? [])
    } else {
      selectedEventTypesUUIDs = getSelectedEventTypes(props.query.EventTypes ?? [])
    }
    const datatype = eventTypeProperties
      .filter((e) => selectedEventTypesUUIDs.includes(e.EventTypeUUID))
      .find((e) => e.Name === property)?.Datatype
    if (!datatype) {
      return PropertyDatatype.Number
    }

    return datatype
  }

  const getTagsKeyOptions = (eventTypes: string[]): string[] => {
    const durationFilterSupported = isFeatureEnabled(props.datasource.historianInfo?.Version ?? '', '7.3.0', true)
    let tagKeyOptions: string[] = []
    if (durationFilterSupported) {
      tagKeyOptions = ['duration']
    }
    tagKeyOptions = [...tagKeyOptions, ...availableSimpleProperties(eventTypes)]

    if (durationFilterSupported) {
      tagKeyOptions = [...tagKeyOptions, 'parent:duration']
    }
    return [...tagKeyOptions, ...availableSimpleProperties(eventTypes, true).map((k) => `parent:${k}`)]
  }

  const availableSimpleProperties = (eventTypeSelectors: string[], onlyParentProperties = false): string[] => {
    if (eventTypeSelectors.some((et) => props.datasource.containsTemplate(et))) {
      return [...new Set(eventTypeProperties.filter((e) => e.Type === PropertyType.Simple).map((e) => e.Name))]
    }
    let selectedEventTypeUUIDs: string[] = []
    if (onlyParentProperties) {
      selectedEventTypeUUIDs = getSelectedParentEventTypes(eventTypeSelectors)
    } else {
      selectedEventTypeUUIDs = getSelectedEventTypes(eventTypeSelectors)
    }
    return [
      ...new Set(
        eventTypeProperties
          .filter((e) => e.Type === PropertyType.Simple)
          .filter((e) => selectedEventTypeUUIDs.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const availablePeriodicProperties = (eventTypeSelectors: string[]): string[] => {
    if (eventTypeSelectors.some((et) => props.datasource.containsTemplate(et))) {
      return [
        ...new Set(
          eventTypeProperties
            .filter((e) =>
              props.query.Type === PropertyType.Periodic
                ? e.Type === PropertyType.PeriodicWithDimension || e.Type === PropertyType.Periodic
                : e.Type === PropertyType.PeriodicWithDimension
            )
            .map((e) => e.Name)
        ),
      ]
    }
    const selectedEventTypeUUIDs = getSelectedEventTypes(eventTypeSelectors)
    return [
      ...new Set(
        eventTypeProperties
          .filter((e) =>
            props.query.Type === PropertyType.Periodic
              ? e.Type === PropertyType.PeriodicWithDimension || e.Type === PropertyType.Periodic
              : e.Type === PropertyType.PeriodicWithDimension
          )
          .filter((e) => selectedEventTypeUUIDs.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const getSelectedEventTypes = (eventTypeSelectors: string[]): string[] => {
    let selectedEventTypeUUIDs = eventTypeSelectors.flatMap((e) => props.datasource.multiSelectReplace(e))
    return selectedEventTypeUUIDs
  }

  const getSelectedParentEventTypes = (eventTypeSelectors: string[]): string[] => {
    const selectedEventTypes = eventTypes.filter((e) => eventTypeSelectors.some((et) => e.UUID === et))
    const parentEventTypes = eventTypes.filter((e) => selectedEventTypes.some((et) => e.UUID === et.ParentUUID))
    const parentEventTypeUUIDs = parentEventTypes.map((e) => e.UUID)
    return parentEventTypeUUIDs
  }

  const availableProperties = (eventTypes: string[], includeParentInfo: boolean): Array<SelectableValue<string>> => {
    let properties = [] as string[]
    if (props.query.Type === PropertyType.Simple) {
      properties = availableSimpleProperties(eventTypes)
      if (includeParentInfo) {
        properties = [...properties, ...availableSimpleProperties(eventTypes, true).map((k) => `parent:${k}`)]
      }
    } else {
      properties = availablePeriodicProperties(eventTypes)
    }

    return properties
      .map((e) => {
        return { label: e, value: e }
      })
      .concat(templateVariables)
  }

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const properties = items.map((e) => e.value || '')
    props.onChangeQuery({
      ...props.query,
      Properties: properties,
    })
  }

  const onSelectProperty = (item: SelectableValue<string>): void => {
    props.onChangeQuery({
      ...props.query,
      Properties: [item.value || ''],
    })
  }

  const availablePropertyValues = (key: string): string[] => {
    const eventTypeProperty = eventTypeProperties
      .filter((e) => props.query.EventTypes?.includes(e.EventTypeUUID))
      .find((e) => e.Name === key)

    if (!eventTypeProperty) {
      return []
    }

    if (eventTypeProperty.Datatype !== PropertyDatatype.Bool) {
      return []
    }

    return ['true', 'false']
  }

  const initialLabel = (): string => {
    if (!props.query.Assets || props.query.Assets.length === 0) {
      return ''
    }

    const asset = assets.find((e) => e.UUID === props.query.Assets[0])
    if (asset) {
      return asset.AssetPath || ''
    }

    return props.query.Assets[0]
  }
  const availableStatuses = (): Array<SelectableValue<string>> => {
    return [
      toSelectableValue('processed'),
      toSelectableValue('open'),
      toSelectableValue('incomplete'),
      toSelectableValue('pending'),
    ].concat(templateVariables)
  }

  const getValueFilterOperators = (): KnownOperator[] => {
    return getValueFilterOperatorsForVersion(props.datasource.historianInfo?.Version ?? '')
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField
              grow
              labelWidth={labelWidth}
              label="Query Type"
              tooltip="Select the property type: simple or periodic"
            >
              <Select
                options={Object.entries(PropertyType)
                  .filter(([_, value]) => isSupportedPropertyType(value, props.datasource.historianInfo?.Version ?? ''))
                  .filter(([_, value]) => !props.isAnnotationQuery || value === PropertyType.Simple)
                  .map(([key, value]) => ({ label: key, value }))}
                value={props.query.Type}
                onChange={onChangeQueryType}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Assets"
              grow
              labelWidth={labelWidth}
              tooltip="Specify an asset to work with, or use a regex to select multiple assets at once (e.g. /Parent\\\\Child.*/)"
            >
              <Cascader
                initialValue={props.query.Assets?.length ? props.query.Assets[0] : ''}
                initialLabel={initialLabel()}
                options={assetOptions}
                displayAllSelectedLevels
                onSelect={onAssetChange}
                onOpen={fetchAll}
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
                value={props.query.EventTypes}
                options={availableEventTypes(props.query.Assets?.length ? props.query.Assets[0] : '')}
                onChange={onSelectEventTypes}
                onOpenMenu={fetchAll}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            {props.multiSelectProperties ? (
              <InlineField
                label="Properties"
                grow
                labelWidth={labelWidth}
                tooltip="Specify one or more event properties to work with, or leave empty to use all event properties"
              >
                <MultiSelect
                  value={props.query.Properties}
                  options={availableProperties(props.query.EventTypes ?? [], props.query.IncludeParentInfo ?? false)}
                  onChange={onSelectProperties}
                  onOpenMenu={fetchAll}
                />
              </InlineField>
            ) : (
              <InlineField label="Property" grow labelWidth={labelWidth} tooltip="Specify the property to include">
                <Select
                  value={props.query.Properties?.length ? props.query.Properties[0] : ''}
                  options={availableProperties(props.query.EventTypes ?? [], false)}
                  onChange={onSelectProperty}
                />
              </InlineField>
            )}
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Statuses"
              grow
              labelWidth={labelWidth}
              tooltip="Specify one or more event statuses to filter events on the selected statuses, or leave empty to use all event statuses"
            >
              <MultiSelect value={props.query.Statuses} options={availableStatuses()} onChange={onSelectStatuses} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="WHERE"
              tooltip="Filter events based on property values of the event or its parent (e.g. event property X value > 0)"
              labelWidth={labelWidth}
            >
              <TagsSection
                tags={propertyFilterToQueryTags(props.query.PropertyFilter ?? [])}
                operators={getValueFilterOperators()}
                getTagKeyOptions={() => Promise.resolve(getTagsKeyOptions(props.query.EventTypes ?? []))}
                getTagValueOptions={(key) => {
                  const isParent = key.startsWith('parent:')
                  const cleanKey = isParent ? key.replace('parent:', '') : key
                  return Promise.resolve(availablePropertyValues(cleanKey))
                }}
                onChange={handleEventPropertyFilterChange}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
    </>
  )
}
