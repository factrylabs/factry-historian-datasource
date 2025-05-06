import React, { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react'
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, Input, MultiSelect, Select } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { default as Cascader } from 'components/Cascader/Cascader'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { toSelectableValue } from 'components/TagsSection/util'
import {
  defaultQueryOptions,
  getChildAssets,
  isSupportedPrototypeType,
  matchedAssets,
  propertyFilterToQueryTags,
  tagsToQueryTags,
  useDebounce,
} from './util'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'
import {
  Asset,
  EventConfiguration,
  EventPropertyFilter,
  EventQuery,
  EventType,
  EventTypeProperty,
  labelWidth,
  MeasurementQueryOptions,
  PropertyDatatype,
  PropertyType,
} from 'types'
import { getValueFilterOperatorsForVersion, KnownOperator, needsValue } from 'util/eventFilter'

export interface Props {
  query: EventQuery
  seriesLimit: number
  datasource: DataSource
  appIsAlertingType?: boolean
  isAnnotationQuery?: boolean
  onChangeEventQuery: (query: EventQuery) => void
  onChangeSeriesLimit: (value: number) => void
}

export const Events = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [eventTypes, setEventTypes] = useState<EventType[]>([])
  const [eventTypeProperties, setEventTypeProperties] = useState<EventTypeProperty[]>([])
  const [eventConfigurations, setEventConfigurations] = useState<EventConfiguration[]>([])
  const [limit, setLimit] = useDebounce<number>(props.query.Limit ?? 1000, 500, (value) => {
    const updatedQuery = { ...props.query, Limit: limit } as EventQuery
    props.onChangeEventQuery(updatedQuery)
  })

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

  const onSelectEventTypes = (items: Array<SelectableValue<string>>): void => {
    const selectedEventTypes = items.map((e) => {
      const eventType = eventTypes.find((et) => et.Name === e.value)
      if (eventType) {
        return eventType.UUID
      }

      return e.value || ''
    })
    const updatedQuery = { ...props.query, EventTypes: selectedEventTypes }
    props.onChangeEventQuery(updatedQuery)
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
        getTemplateSrv()
          .getVariables()
          .map((e) => {
            return { label: `$${e.name}`, value: `$${e.name}` }
          })
      )
  }

  const onSelectStatuses = (items: Array<SelectableValue<string>>): void => {
    const statuses = items.map((e) => {
      return e.value || ''
    })
    const updatedQuery = { ...props.query, Statuses: statuses }
    props.onChangeEventQuery(updatedQuery)
  }

  const onAssetChange = (value: string): void => {
    const updatedQuery = {
      ...props.query,
      Assets: [value],
    }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryType = (item: SelectableValue<string>): void => {
    const updatedQuery = {
      ...props.query,
      Type: item.value || PropertyType.Simple,
    }
    props.onChangeEventQuery(updatedQuery)
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
    const updatedQuery = {
      ...props.query,
      PropertyFilter: propertyFilter,
    }
    props.onChangeEventQuery(updatedQuery)
  }

  const getDatatype = (property: string, isParent: boolean): PropertyDatatype => {
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
    return [
      ...availableSimpleProperties(eventTypes),
      ...availableSimpleProperties(eventTypes, true).map(k => `parent:${k}`),
    ]
  }

  const availableSimpleProperties = (eventTypeSelectors: string[], onlyParentProperties = false): string[] => {
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
    const selectedEventTypes = eventTypes.filter((e) =>
      eventTypeSelectors.some((et) => e.UUID === et)
    )
    const parentEventTypes = eventTypes.filter((e) =>
      selectedEventTypes.some((et) => e.UUID === et.ParentUUID)
    )
    const parentEventTypeUUIDs = parentEventTypes.map((e) => e.UUID)
    return parentEventTypeUUIDs
  }

  const availableProperties = (eventTypes: string[], includeParentInfo: boolean): Array<SelectableValue<string>> => {
    let properties = [] as string[]
    if (props.query.Type === PropertyType.Simple) {
      properties = availableSimpleProperties(eventTypes)
      if (includeParentInfo) {
        properties = [
          ...properties,
          ...availableSimpleProperties(eventTypes, true).map((k) => `parent:${k}`),
        ]
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
    const updatedQuery = { ...props.query, Properties: properties }
    props.onChangeEventQuery(updatedQuery)
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

  const onChangeQueryAssetProperties = (event: FormEvent<HTMLInputElement>): void => {
    const enabled = (event as ChangeEvent<HTMLInputElement>).target.checked
    const updatedQuery = { ...props.query, QueryAssetProperties: enabled } as EventQuery
    if (enabled && !updatedQuery.Options) {
      updatedQuery.Options = defaultQueryOptions(props.appIsAlertingType ?? false)
    }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeIncludeParentInfo = (event: FormEvent<HTMLInputElement>): void => {
    const enabled = (event as ChangeEvent<HTMLInputElement>).target.checked
    const updatedQuery = { ...props.query, IncludeParentInfo: enabled } as EventQuery
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeLimit = (event: ChangeEvent<HTMLInputElement>): void => {
    setLimit(Number(event.target.value))
  }

  const onChangeAssetProperties = (values: string[]): void => {
    const updatedQuery = { ...props.query, AssetProperties: values }
    props.onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryOptions = (options: MeasurementQueryOptions): void => {
    const updatedQuery = { ...props.query, Options: options }
    props.onChangeEventQuery(updatedQuery)
  }

  const getValueFilterOperators = (): KnownOperator[] => {
    return getValueFilterOperatorsForVersion(props.datasource.historianInfo?.Version ?? '')
  }

  return (
    <>
      {!loading && (
        <>
          <FieldSet label="Event query">
            <InlineFieldRow>
              <InlineField
                grow
                labelWidth={labelWidth}
                label="Query Type"
                tooltip="Specify a property type to work with"
              >
                <Select
                  options={Object.entries(PropertyType)
                    .filter(([_, value]) =>
                      isSupportedPrototypeType(value, props.datasource.historianInfo?.Version ?? '')
                    )
                    .filter(([_, value]) => !props.isAnnotationQuery || value === PropertyType.Simple)
                    .map(([key, value]) => ({ label: key, value }))}
                  value={props.query.Type}
                  onChange={onChangeQueryType}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Assets" grow labelWidth={labelWidth} tooltip="Specify an asset to work with">
                <Cascader
                  initialValue={props.query.Assets?.length ? props.query.Assets[0] : ''}
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
                  value={props.query.EventTypes}
                  options={availableEventTypes(props.query.Assets?.length ? props.query.Assets[0] : '')}
                  onChange={onSelectEventTypes}
                  onOpenMenu={fetchAll}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Properties" grow labelWidth={labelWidth} tooltip="Specify the properties to include">
                <MultiSelect
                  value={props.query.Properties}
                  options={availableProperties(props.query.EventTypes ?? [], props.query.IncludeParentInfo ?? false)}
                  onChange={onSelectProperties}
                  onOpenMenu={fetchAll}
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
                <MultiSelect value={props.query.Statuses} options={availableStatuses()} onChange={onSelectStatuses} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField
                label="WHERE"
                tooltip="Filters events based on property values (regular and parent)"
                labelWidth={labelWidth}
              >
                <TagsSection
                  tags={propertyFilterToQueryTags(props.query.PropertyFilter ?? [])}
                  operators={getValueFilterOperators()}
                  getTagKeyOptions={() =>
                    Promise.resolve(getTagsKeyOptions(props.query.EventTypes ?? []))
                  }
                  getTagValueOptions={(key) => {
                    const isParent = key.startsWith('parent:')
                    const cleanKey = isParent ? key.replace('parent:', '') : key
                    return Promise.resolve(availablePropertyValues(cleanKey))
                  }}
                  onChange={handleEventPropertyFilterChange}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField
                label="Include parent info"
                tooltip="For simple properties it will add columns for the parent event and for periodic properties it will add labels"
                labelWidth={labelWidth}
              >
                <InlineSwitch value={props.query.IncludeParentInfo} onChange={onChangeIncludeParentInfo} />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField
                label="Limit"
                tooltip="Limit the number of events returned, 0 for no limit"
                labelWidth={labelWidth}
              >
                <Input value={limit} type="number" min={0} onChange={onChangeLimit} />
              </InlineField>
            </InlineFieldRow>
          </FieldSet>
          <FieldSet label="Query asset properties">
            <InlineFieldRow>
              <InlineField label="Enabled" labelWidth={labelWidth}>
                <InlineSwitch value={props.query.QueryAssetProperties} onChange={onChangeQueryAssetProperties} />
              </InlineField>
            </InlineFieldRow>
            {props.query.QueryAssetProperties && (
              <EventAssetProperties
                appIsAlertingType={props.appIsAlertingType ?? false}
                datasource={props.datasource}
                seriesLimit={props.seriesLimit}
                queryOptions={props.query.Options ?? defaultQueryOptions(props.appIsAlertingType ?? false)}
                selectedAssetProperties={props.query.AssetProperties ?? []}
                selectedAssets={getSelectedAssets(props.query.Assets.length ? props.query.Assets[0] : '', assets)}
                templateVariables={templateVariables}
                tags={tagsToQueryTags(props.query.Options?.Tags)}
                queryType={props.query.Type}
                onChangeAssetProperties={onChangeAssetProperties}
                onChangeQueryOptions={onChangeQueryOptions}
                onChangeSeriesLimit={props.onChangeSeriesLimit}
                onOpenMenu={fetchAll}
              />
            )}
          </FieldSet>
        </>
      )}
    </>
  )
}
