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
  isSupportedPropertyType,
  matchedAssets,
  NIL_UUID,
  propertyFilterToQueryTags,
  resolveAssetLabel,
  templateVariablesToCascaderOptions,
  updateTreeChildren,
} from './util'
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
    const rootAssets = await props.datasource.getAssets({ ParentUUIDs: [NIL_UUID] })
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
    const allAssets = await props.datasource.getAssets()
    setAssets(allAssets)
    await Promise.all([fetchRootAssets(), fetchEventData()])
  }, [props.datasource, fetchRootAssets, fetchEventData])

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

      if (targetOption.items?.some((item) => !item.isLeaf)) {
        return
      }

      props.datasource.getAssets({ ParentUUIDs: [parentUUID] }).then((children) => {
        const childOptions = buildLazyCascaderOptions(children, [])
        setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, childOptions))
      }).catch(() => {})
    },
    [props.datasource]
  )

  const handleSearchAsync = useCallback(
    async (keyword: string): Promise<Array<SelectableValue<string[]>>> => {
      if (!keyword || keyword.length < 2) {
        return []
      }
      const searchAssets = await props.datasource.getAssets({ Keyword: keyword, UseAssetPath: true })
      return searchAssets.map((asset) => ({
        label: `📦 ${asset.AssetPath || asset.Name}`,
        value: [asset.UUID],
      }))
    },
    [props.datasource]
  )

  const getSelectedAssets = (selected: string | undefined, allAssets: Asset[]): Asset[] => {
    const replacedAssets = props.datasource.multiSelectReplace(selected, {})
    return matchedAssets(replacedAssets, allAssets)
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

  const getDisplayedEventTypes = (eventTypes: string[], selectedAsset: string | undefined): string[] => {
    const available = availableEventTypes(selectedAsset)
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
                onOpen={() => { if (assetOptions.length === 0) { fetchRootAssets() } }}
                separator="\\"
                loadData={handleLoadData}
                onSearchAsync={handleSearchAsync}
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
                value={getDisplayedEventTypes(
                  props.query.EventTypes ?? [],
                  props.query.Assets?.length ? props.query.Assets[0] : ''
                )}
                options={availableEventTypes(props.query.Assets?.length ? props.query.Assets[0] : '')}
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
