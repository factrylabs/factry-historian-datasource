import React, { ChangeEvent, FormEvent } from 'react'
import { FieldSet, InlineField, InlineFieldRow, InlineSwitch, MultiSelect, Select } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { Cascader } from 'components/Cascader/Cascader'
import { QueryTag, TagsSection } from 'components/TagsSection/TagsSection'
import { toSelectableValue } from 'components/TagsSection/util'
import { defaultQueryOptions, getChildAssets, matchedAssets, tagsToQueryTags } from './util'
import {
  EventPropertyFilter,
  EventQuery,
  labelWidth,
  MeasurementQueryOptions,
  PropertyDatatype,
  PropertyType,
  QueryEditorState,
} from 'types'
import { EventAssetProperties } from './EventAssetProperties'
import { DataSource } from 'datasource'

export interface Props {
  datasource: DataSource
  state: QueryEditorState
  appIsAlertingType: boolean
  saveState(state: QueryEditorState): void
  onChangeEventQuery: (query: EventQuery) => void
}

export const Events = ({ datasource, state, appIsAlertingType, saveState, onChangeEventQuery }: Props): JSX.Element => {
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })
  const assetOptions = getChildAssets(null, state.assets).concat(templateVariables)

  const onSelectEventTypes = (items: Array<SelectableValue<string>>): void => {
    const eventTypes = items.map((e) => {
      const eventType = state.eventTypes.find((et) => et.Name === e.value)
      if (eventType) {
        return eventType.UUID
      }

      return e.value || ''
    })
    const updatedQuery = { ...state.eventsState.eventQuery, EventTypes: eventTypes }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
        selectedEventTypes: items,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const availableEventTypes = (selected: string | undefined): Array<SelectableValue<string>> => {
    const replaced = getTemplateSrv().replace(selected)
    return state.eventTypes
      .filter((e) =>
        state.eventConfigurations.some(
          (ec) =>
            (ec.AssetUUID === replaced || matchedAssets(replaced, state.assets).find((a) => a.UUID === ec.AssetUUID)) &&
            ec.EventTypeUUID === e.UUID
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
    const updatedQuery = { ...state.eventsState.eventQuery, Statuses: statuses }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
        selectedStatuses: items,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const onAssetChange = (value: string): void => {
    const updatedQuery = {
      ...state.eventsState.eventQuery,
      Assets: [value],
    }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        selectedAsset: value,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryType = (item: SelectableValue<string>): void => {
    const updatedQuery = {
      ...state.eventsState.eventQuery,
      Type: item.value || PropertyType.Simple,
    }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const handleTagsSectionChange = (updatedTags: QueryTag[]): void => {
    const filter: EventPropertyFilter[] = []
    updatedTags.forEach((tag) => {
      if (tag.value === undefined || tag.value === 'select tag value') {
        return
      }

      const dataType = getDatatype(tag.key)
      let eventPropertyFilter: EventPropertyFilter = {
        Property: tag.key,
        Datatype: dataType,
        Condition: tag.condition || '',
        Operator: tag.operator || '=',
        Value: tag.value,
      }
      filter.push(eventPropertyFilter)
    })
    const updatedQuery = { ...state.eventsState.eventQuery, PropertyFilter: filter } as EventQuery
    onChangeEventQuery(updatedQuery)
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
        tags: updatedTags,
      },
    } as QueryEditorState)
  }

  const getDatatype = (property: string): PropertyDatatype => {
    const datatype = state.eventTypeProperties
      .filter((e) => state.eventsState.eventQuery.EventTypes?.includes(e.EventTypeUUID))
      .find((e) => e.Name === property)?.Datatype

    if (!datatype) {
      return PropertyDatatype.Number
    }

    return datatype
  }

  const availableSimpleProperties = (): string[] => {
    return [
      ...new Set(
        state.eventTypeProperties
          .filter((e) => e.Type === PropertyType.Simple)
          .filter((e) => state.eventsState.eventQuery.EventTypes?.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const availablePeriodicProperties = (): string[] => {
    return [
      ...new Set(
        state.eventTypeProperties
          .filter((e) => e.Type === PropertyType.Periodic)
          .filter((e) => state.eventsState.eventQuery.EventTypes?.includes(e.EventTypeUUID))
          .map((e) => e.Name)
      ),
    ]
  }

  const availableProperties = (): Array<SelectableValue<string>> => {
    let properties = [] as string[]
    if (state.eventsState.eventQuery.Type === PropertyType.Simple) {
      properties = availableSimpleProperties()
    } else {
      properties = availablePeriodicProperties()
    }

    return properties
      .map((e) => {
        return { label: e, value: e }
      })
      .concat(templateVariables)
  }

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const properties = items.map((e) => e.value || '')
    const updatedQuery = { ...state.eventsState.eventQuery, Properties: properties }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        selectedProperties: items,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const availablePropertyValues = (key: string): string[] => {
    const eventTypeProperty = state.eventTypeProperties
      .filter((e) => state.eventsState.eventQuery.EventTypes?.includes(e.EventTypeUUID))
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
    const asset = state.assets.find((e) => e.UUID === state.eventsState.selectedAsset)
    if (asset) {
      return asset.AssetPath || ''
    }

    return state.eventsState.selectedAsset || ''
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
    const updatedQuery = { ...state.eventsState.eventQuery, QueryAssetProperties: enabled } as EventQuery
    if (enabled && !updatedQuery.Options) {
      updatedQuery.Options = defaultQueryOptions(appIsAlertingType)
    }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const onChangeAssetProperties = (values: string[]): void => {
    const updatedQuery = { ...state.eventsState.eventQuery, AssetProperties: values }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const onChangeQueryOptions = (options: MeasurementQueryOptions): void => {
    const updatedQuery = { ...state.eventsState.eventQuery, Options: options }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  return (
    <>
      <FieldSet label="Event query">
        <InlineFieldRow>
          <InlineField grow labelWidth={labelWidth} label="Query Type" tooltip="Specify a property type to work with">
            <Select
              options={Object.entries(PropertyType).map(([key, value]) => ({ label: key, value }))}
              value={state.eventsState.eventQuery.Type}
              onChange={onChangeQueryType}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Assets" grow labelWidth={labelWidth} tooltip="Specify an asset to work with">
            <Cascader
              initialValue={state.eventsState.selectedAsset}
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
              value={state.eventsState.selectedEventTypes}
              options={availableEventTypes(getTemplateSrv().replace(state.eventsState.selectedAsset))}
              onChange={onSelectEventTypes}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Properties" grow labelWidth={labelWidth} tooltip="Specify the properties to include">
            <MultiSelect
              value={state.eventsState.selectedProperties}
              options={availableProperties()}
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
              value={state.eventsState.selectedStatuses}
              options={availableStatuses()}
              onChange={onSelectStatuses}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="WHERE" labelWidth={labelWidth}>
            <TagsSection
              tags={state.eventsState.tags}
              operators={['=', '!=', '<', '<=', '>', '>=']}
              getTagKeyOptions={() => Promise.resolve(availableSimpleProperties())}
              getTagValueOptions={(key) => Promise.resolve(availablePropertyValues(key))}
              onChange={handleTagsSectionChange}
            />
          </InlineField>
        </InlineFieldRow>
      </FieldSet>
      <FieldSet label="Query asset properties">
        <InlineFieldRow>
          <InlineField label="Enabled" labelWidth={labelWidth}>
            <InlineSwitch
              value={state.eventsState.eventQuery.QueryAssetProperties}
              onChange={onChangeQueryAssetProperties}
            />
          </InlineField>
        </InlineFieldRow>
        {state.eventsState.eventQuery.QueryAssetProperties && (
          <EventAssetProperties
            appIsAlertingType={appIsAlertingType}
            datasource={datasource}
            queryOptions={state.eventsState.eventQuery.Options ?? defaultQueryOptions(appIsAlertingType)}
            selectedAssetProperties={state.eventsState.eventQuery.AssetProperties ?? []}
            selectedAssets={matchedAssets(state.eventsState.selectedAsset, state.assets)}
            templateVariables={templateVariables}
            tags={tagsToQueryTags(state.eventsState.eventQuery.Options?.Tags)}
            onChangeAssetProperties={onChangeAssetProperties}
            onChangeQueryOptions={onChangeQueryOptions}
          />
        )}
      </FieldSet>
    </>
  )
}
