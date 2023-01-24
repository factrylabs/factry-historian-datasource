import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader } from 'components/Cascader/Cascader'
import { getChildAssets } from './util'
import type { EventQuery, QueryEditorState } from 'types'

export interface Props {
  state: QueryEditorState
  saveState(state: QueryEditorState): void
  onChangeEventQuery: (query: EventQuery) => void
}

export const Events = ({
  state, saveState,
  onChangeEventQuery
}: Props): JSX.Element => {
  const assetOptions = getChildAssets(null, state.assets)

  const onSelectEventTypes = (items: Array<SelectableValue<string>>): void => {
    const eventTypes = state.eventTypes.filter(e => items.map(e => e.value).includes(e.UUID)).map(e => e.UUID)
    const updatedQuery = { ...state.eventsState.eventQuery, EventTypes: eventTypes }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        eventQuery: updatedQuery,
        selectedEventTypes: items
      },
    })
    onChangeEventQuery(updatedQuery)
  }

  const availableEventTypes = (selected: string | undefined): Array<SelectableValue<string>> => {
    return state.eventTypes.
      filter(e => state.eventConfigurations.some(ec => ec.AssetUUID === selected && ec.EventTypeUUID === e.UUID)).
      map(e => { return { label: e.Name, value: e.UUID } })
  }

  const onAssetChange = (value: string): void => {
    const updatedQuery = { ...state.eventsState.eventQuery, Assets: [value] }
    saveState({
      ...state,
      eventsState: {
        ...state.eventsState,
        selectedAsset: value,
        eventQuery: updatedQuery
      }
    })
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Asset" grow labelWidth={20} tooltip="Specify an asset to work with">
          <Cascader
            initialValue={state.eventsState.selectedAsset}
            options={assetOptions}
            displayAllSelectedLevels
            onSelect={onAssetChange}
            separator='\'
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Event type" grow labelWidth={20} tooltip="Specify one or more event type to work with">
          <MultiSelect
            value={state.eventsState.selectedEventTypes}
            options={availableEventTypes(state.eventsState.selectedAsset)}
            onChange={onSelectEventTypes}
          />
        </InlineField>
      </InlineFieldRow>
    </div>
  )
}
