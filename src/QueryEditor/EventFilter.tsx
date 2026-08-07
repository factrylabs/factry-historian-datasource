import React, { useCallback, useEffect, useState } from 'react'
import { InlineField, InlineFieldRow, MultiSelect, Select } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { default as Cascader, CascaderOption } from 'components/Cascader/Cascader'
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
import {
  buildLazyCascaderOptions,
  eventTypeUUIDsForProperties,
  fetchLazyChildOptions,
  getChildAssets,
  isLazyLoadingEnabled,
  isSupportedPropertyType,
  matchedAssets,
  NIL_UUID,
  parentEventTypeUUIDs,
  propertyFilterToQueryTags,
  resolveAssetLabel,
  resolvePropertyDatatype,
  resolveSelectedAssets,
  searchAssetsAndProperties,
  templateVariablesToCascaderOptions,
  updateTreeChildren,
} from './util'
import { isFeatureEnabled } from 'util/semver'
import { isRegex, isUUID } from 'util/util'
import { notifyError } from 'util/notify'

export interface Props {
  query: EventQuery
  datasource: DataSource
  isAnnotationQuery?: boolean
  multiSelectProperties?: boolean
  onChangeQuery: (query: EventQuery) => void
}

export const EventFilter = (props: Props): JSX.Element => {
  const lazyEnabled = isLazyLoadingEnabled(props.datasource.historianInfo?.Version ?? '')

  const [loading, setLoading] = useState(true)
  // Full asset list, only populated in the eager (pre-v8.2.0) fallback.
  const [assets, setAssets] = useState<Asset[]>([])
  // Assets matching the current selection, used to filter event types by event
  // configuration. Resolved server-side in the lazy path so we never fetch the
  // whole asset list.
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [assetOptions, setAssetOptions] = useState<CascaderOption[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [eventTypeProperties, setEventTypeProperties] = useState<EventTypeProperty[]>([])
  const [eventConfigurations, setEventConfigurations] = useState<EventConfiguration[]>([])
  const [initialLabel, setInitialLabel] = useState('')
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  const fetchRootAssets = useCallback(async () => {
    const rootAssets = await props.datasource.getAssets({
      ParentUUIDs: [NIL_UUID],
      IncludeHasChildren: true,
    })
    const options = buildLazyCascaderOptions(rootAssets, []).concat(
      templateVariablesToCascaderOptions(templateVariables)
    )
    setAssetOptions(options)
  }, [props.datasource, templateVariables])

  const fetchEventData = useCallback(async () => {
    const [types, typeProperties, configurations] = await Promise.all([
      props.datasource.getEventTypes(),
      props.datasource.getEventTypeProperties(),
      props.datasource.getEventConfigurations(),
    ])
    setEventTypes(types)
    setEventTypeProperties(typeProperties)
    setEventConfigurations(configurations)
  }, [props.datasource])

  const fetchAll = useCallback(async () => {
    const selectedValue = props.query.Assets?.[0] ?? ''
    if (lazyEnabled) {
      // Resolve only the current selection server-side instead of pulling the
      // full asset list, which is prohibitively slow with many assets.
      const [resolved] = await Promise.all([
        resolveSelectedAssets(props.datasource, selectedValue),
        fetchRootAssets(),
        fetchEventData(),
      ])
      setSelectedAssets(resolved)
    } else {
      // Eager fallback (pre-v8.2.0): the full asset list is needed both to build
      // the tree and to resolve the selection for event-type filtering.
      const allAssets = await props.datasource.getAssets()
      setAssets(allAssets)
      setAssetOptions(getChildAssets(null, allAssets).concat(templateVariablesToCascaderOptions(templateVariables)))
      setSelectedAssets(matchedAssets(props.datasource.multiSelectReplace(selectedValue, {}), allAssets))
      await fetchEventData()
    }
  }, [props.datasource, lazyEnabled, fetchRootAssets, fetchEventData, templateVariables, props.query.Assets])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        const resolved = resolveAssetLabel(props.datasource, props.query.Assets?.[0])
        await Promise.all([fetchAll(), resolved.then(({ label }) => setInitialLabel(label))])
        setLoading(false)
      })()
    }
  }, [loading, fetchAll, props.datasource, props.query.Assets])

  const handleLoadData = useCallback(
    (selectOptions: CascaderOption[]) => {
      const targetOption = selectOptions[selectOptions.length - 1]
      const parentUUID = targetOption.value

      // Already loaded (or known leaf): don't refetch on every expand.
      if (targetOption.isLeaf || (targetOption.items && targetOption.items.length > 0)) {
        return
      }

      fetchLazyChildOptions(props.datasource, parentUUID, false)
        .then((children) => setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, children)))
        .catch((error) => {
          // Clear the node's loading state so the cascader spinner stops.
          setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, []))
          notifyError('Failed to load child assets', error)
        })
    },
    [props.datasource]
  )

  const handleSearchAsync = useCallback(
    // This tree only selects assets, so leave the properties out of the search results.
    (keyword: string) => searchAssetsAndProperties(props.datasource, keyword, false),
    [props.datasource]
  )

  const availableEventTypes = (): Array<SelectableValue<string>> => {
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

  const filterEventTypesByAssets = (selectedEventTypes: string[], assetsToMatch: Asset[]): string[] => {
    return selectedEventTypes.filter((et) => {
      if (props.datasource.containsTemplate(et)) {
        return true
      }

      return eventConfigurations.some(
        (ec) => assetsToMatch.find((a) => a.UUID === ec.AssetUUID) && ec.EventTypeUUID === et
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

    const filteredEventTypes = filterEventTypesByAssets(selectedEventTypes, selectedAssets)
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

  const applyAssetChange = async (value: string): Promise<void> => {
    if (!isUUID(value) && !isRegex(value) && !props.datasource.containsTemplate(value)) {
      if (!props.query.Assets || props.query.Assets.length === 0) {
        return
      }

      setSelectedAssets([])
      props.onChangeQuery({
        ...props.query,
        Assets: [],
        EventTypes: [],
        Properties: [],
      })
      return
    }
    // Resolve the new selection to concrete assets (server-side when lazy) so we
    // can filter the existing event types/properties down to the valid ones.
    const resolvedAssets = lazyEnabled
      ? await resolveSelectedAssets(props.datasource, value)
      : matchedAssets(props.datasource.multiSelectReplace(value, {}), assets)
    setSelectedAssets(resolvedAssets)
    const filteredEventTypes = filterEventTypesByAssets(props.query.EventTypes ?? [], resolvedAssets)
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

  // The Cascader's onSelect expects a void handler, so kick off the async work
  // and log any rejection instead of letting it surface as an unhandled rejection.
  const onAssetChange = (value: string): void => {
    applyAssetChange(value).catch((error) => {
      notifyError('Failed to handle asset selection', error)
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

    return resolvePropertyDatatype(property, eventTypeProperties, selectedEventTypesUUIDs)
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
    const eventTypeUUIDs = eventTypeUUIDsForProperties(
      props.datasource,
      eventTypeSelectors,
      eventTypes,
      onlyParentProperties
    )
    return [
      ...new Set(
        eventTypeProperties
          .filter((e) => e.Type === PropertyType.Simple)
          .filter((e) => eventTypeUUIDs.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const availablePeriodicProperties = (eventTypeSelectors: string[]): string[] => {
    const eventTypeUUIDs = eventTypeUUIDsForProperties(props.datasource, eventTypeSelectors, eventTypes, false)
    return [
      ...new Set(
        eventTypeProperties
          .filter((e) =>
            props.query.Type === PropertyType.Periodic
              ? e.Type === PropertyType.PeriodicWithDimension || e.Type === PropertyType.Periodic
              : e.Type === PropertyType.PeriodicWithDimension
          )
          .filter((e) => eventTypeUUIDs.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const getSelectedEventTypes = (eventTypeSelectors: string[]): string[] => {
    let selectedEventTypeUUIDs = eventTypeSelectors.flatMap((e) => props.datasource.multiSelectReplace(e))
    return selectedEventTypeUUIDs
  }

  const getSelectedParentEventTypes = (eventTypeSelectors: string[]): string[] => {
    return parentEventTypeUUIDs(getSelectedEventTypes(eventTypeSelectors), eventTypes)
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

  const getDisplayedEventTypes = (eventTypes: string[], available: Array<SelectableValue<string>>): string[] => {
    return eventTypes.filter((eventTypeUUID) => {
      if (eventTypeUUID.startsWith('$')) {
        return true
      }
      return available.some((option) => option.value === eventTypeUUID)
    })
  }

  const getDisplayedProperties = (properties: string[], eventTypes: string[], includeParentInfo: boolean): string[] => {
    const available = availableProperties(eventTypes, includeParentInfo)
    return properties.filter((property) => {
      if (property.startsWith('$')) {
        return true
      }
      return available.some((option) => option.value === property)
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

  const eventTypeOptions = availableEventTypes()

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
                initialLabel={initialLabel}
                options={assetOptions}
                displayAllSelectedLevels
                onSelect={onAssetChange}
                onOpen={() => {
                  if (lazyEnabled) {
                    if (assetOptions.length === 0) {
                      fetchRootAssets()
                    }
                    return
                  }
                  fetchAll()
                }}
                separator="\\"
                loadData={lazyEnabled ? handleLoadData : undefined}
                onSearchAsync={lazyEnabled ? handleSearchAsync : undefined}
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
                value={getDisplayedEventTypes(props.query.EventTypes ?? [], eventTypeOptions)}
                options={eventTypeOptions}
                onChange={onSelectEventTypes}
                onOpenMenu={fetchEventData}
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
                  value={getDisplayedProperties(
                    props.query.Properties ?? [],
                    props.query.EventTypes ?? [],
                    props.query.IncludeParentInfo ?? false
                  )}
                  options={availableProperties(props.query.EventTypes ?? [], props.query.IncludeParentInfo ?? false)}
                  onChange={onSelectProperties}
                  onOpenMenu={fetchEventData}
                />
              </InlineField>
            ) : (
              <InlineField label="Property" grow labelWidth={labelWidth} tooltip="Specify the property to include">
                <Select
                  value={
                    getDisplayedProperties(
                      props.query.Properties ?? [],
                      props.query.EventTypes ?? [],
                      props.query.IncludeParentInfo ?? false
                    )[0] || ''
                  }
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
