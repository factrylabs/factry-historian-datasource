import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader } from 'components/Cascader/Cascader'
import { QueryOptions } from './QueryOptions'
import { getChildAssets, matchedAssets } from './util'
import type { MeasurementQuery, MeasurementQueryState, QueryEditorState } from 'types'

export interface Props {
  state: QueryEditorState
  saveState(state: QueryEditorState): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
}

export const Assets = ({
  state, saveState,
  onChangeMeasurementQuery
}: Props): JSX.Element => {
  const assetOptions = getChildAssets(null, state.assets)

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const selectedAssetProperties = state.assetProperties.filter(e => e.AssetUUID === state.assetsState.selectedAsset && items.map(e => e.value).includes(e.Name))
    const measurements = selectedAssetProperties.map(e => e.MeasurementUUID)
    const updatedQuery = { ...state.assetsState.queryOptions.measurementQuery, Measurements: measurements }
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        selectedProperties: items,
        queryOptions: {
          ...state.assetsState.queryOptions,
          measurementQuery: updatedQuery
        }
      }
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  const availableProperties = (selected: string | undefined): Array<SelectableValue<string>> => {
    return state.assetProperties.
      filter(e => e.AssetUUID === selected || matchedAssets(selected, state.assets).find(a => a.UUID === e.AssetUUID)).
      map(e => { return { label: e.Name, value: e.Name } }).
      filter((value, index, self) => self.indexOf(value) === index)
  }

  const onAssetChange = (value: string): void => {
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        queryOptions: {
          ...state.assetsState.queryOptions,
          filter: { ...state.assetsState.queryOptions.filter, Asset: value }
        },
        selectedAsset: value
      }
    })
  }

  const handleChangeMeasurementQuery = (options: MeasurementQueryState): void => {
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        queryOptions: options
      }
    })
    onChangeMeasurementQuery(options.measurementQuery)
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Asset" grow labelWidth={20} tooltip="Specify an asset to work with">
          <Cascader
            initialValue={state.assetsState.selectedAsset}
            options={assetOptions}
            displayAllSelectedLevels
            onSelect={onAssetChange}
            separator='\\'
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Properties" grow labelWidth={20} tooltip="Specify one or more asset properties to work with">
          <MultiSelect
            value={state.assetsState.selectedProperties}
            options={availableProperties(state.assetsState.selectedAsset)}
            onChange={onSelectProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={state.assetsState.queryOptions}
        onChange={handleChangeMeasurementQuery}
      />
    </div>
  )
}
