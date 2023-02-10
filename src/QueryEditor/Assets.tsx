import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { Cascader } from 'components/Cascader/Cascader'
import { QueryTag } from 'components/TagsSection/types'
import { QueryOptions } from './QueryOptions'
import { getAssetPath, getChildAssets, matchedAssets, replaceAsset } from './util'
import type { AssetMeasurementQuery, MeasurementQueryOptions, QueryEditorState } from 'types'

export interface Props {
  state: QueryEditorState
  appIsAlertingType: boolean
  saveState(state: QueryEditorState): void
  onChangeAssetMeasurementQuery: (query: AssetMeasurementQuery) => void
}

export const Assets = ({
  state, appIsAlertingType, saveState,
  onChangeAssetMeasurementQuery
}: Props): JSX.Element => {
  const replacedAsset = replaceAsset(state.assetsState.selectedAsset, state.assets)
  const assetOptions = getChildAssets(null, state.assets)

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const assetProperties = items.map(e => e.value)
    const updatedQuery = { ...state.assetsState.options.query, AssetProperties: assetProperties } as AssetMeasurementQuery
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        selectedProperties: items,
        options: {
          ...state.assetsState.options,
          query: updatedQuery
        }
      },
    })
    onChangeAssetMeasurementQuery(updatedQuery)
  }

  const availableProperties = (selected: string | undefined): Array<SelectableValue<string>> => {
    const props = state.assetProperties.
      filter(e => e.AssetUUID === selected || matchedAssets(selected, state.assets).find(a => a.UUID === e.AssetUUID)).
      map(e => e.Name)
    return props.filter((value, index, self) => self.indexOf(value) === index).
      map(e => { return { label: e, value: e } }).
      concat(getTemplateSrv().getVariables().map(e => { return { label: `$${e.name}`, value: `$${e.name}` } }))
  }

  const onAssetChange = (value: string): void => {
    const updatedQuery = { ...state.assetsState.options.query, Assets: matchedAssets(getTemplateSrv().replace(value), state.assets).map(e => e.UUID) } as AssetMeasurementQuery
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        options: {
          ...state.assetsState.options,
          query: updatedQuery
        },
        selectedAsset: value
      }
    })
    onChangeAssetMeasurementQuery(updatedQuery)
  }

  const handleChangeMeasurementQueryOptions = (options: MeasurementQueryOptions, tags: QueryTag[]): void => {
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        options: {
          ...state.assetsState.options,
          query: {
            ...state.assetsState.options.query,
            Options: options
          },
          tags: tags
        }
      }
    })
    onChangeAssetMeasurementQuery({
      ...state.assetsState.options.query,
      Options: options
    })
  }

  const initialLabel = (): string => {
    const asset = state.assets.find(e => e.UUID === state.assetsState.selectedAsset)
    if (asset) {
      return getAssetPath(asset, state.assets)
    }

    return state.assetsState.selectedAsset || ''
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Assets" grow labelWidth={20} tooltip="Specify an asset to work with, you can use regex by entering your pattern between forward slashes">
          <Cascader
            initialValue={state.assetsState.selectedAsset}
            initialLabel={initialLabel()}
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
            options={availableProperties(replacedAsset)}
            onChange={onSelectProperties}
            allowCustomValue
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={state.assetsState.options.query.Options}
        tags={state.assetsState.options.tags}
        appIsAlertingType={appIsAlertingType}
        onChange={handleChangeMeasurementQueryOptions}
      />
    </div>
  )
}
