import React from 'react'
import { CascaderOption, InlineField, InlineFieldRow } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader } from 'components/Cascader/Cascader'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { QueryTag } from 'components/TagsSection/types'
import { QueryOptions } from './QueryOptions'
import { getChildAssets, matchedAssets, replaceAsset } from './util'
import { AssetMeasurementQuery, labelWidth, MeasurementQueryOptions, QueryEditorState } from 'types'

export interface Props {
  state: QueryEditorState
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  saveState(state: QueryEditorState): void
  onChangeAssetMeasurementQuery: (query: AssetMeasurementQuery) => void
}

export const Assets = ({
  state,
  appIsAlertingType,
  templateVariables,
  saveState,
  onChangeAssetMeasurementQuery,
}: Props): JSX.Element => {
  const replacedAsset = replaceAsset(state.assetsState.selectedAsset, state.assets)
  const assetOptions = getChildAssets(null, state.assets, state.assetProperties).concat(
    templateVariables.map((e) => {
      return { value: e.value, label: e.label } as CascaderOption
    })
  )

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const assetProperties = items.map((e) => e.value)
    const updatedQuery = {
      ...state.assetsState.options.query,
      AssetProperties: assetProperties,
    } as AssetMeasurementQuery
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        selectedProperties: items,
        options: {
          ...state.assetsState.options,
          query: updatedQuery,
        },
      },
    })
    onChangeAssetMeasurementQuery(updatedQuery)
  }

  const onAssetChange = (asset: string, property?: string): void => {
    let properties: string[] = []
    let selectedProperties: Array<SelectableValue<string>> = []
    if (property) {
      const assetProperty = state.assetProperties.find((e) => e.UUID === property)
      if (assetProperty) {
        selectedProperties = [
          {
            value: assetProperty.Name,
            label: assetProperty.Name,
          } as SelectableValue<string>,
        ]
        properties = [assetProperty.Name]
      }
    }
    const updatedQuery = {
      ...state.assetsState.options.query,
      Assets: [asset],
      AssetProperties: properties,
    } as AssetMeasurementQuery
    saveState({
      ...state,
      assetsState: {
        ...state.assetsState,
        selectedProperties: selectedProperties,
        options: {
          ...state.assetsState.options,
          query: updatedQuery,
        },
        selectedAsset: asset,
      },
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
            Options: options,
          },
          tags: tags,
        },
      },
    })
    onChangeAssetMeasurementQuery({
      ...state.assetsState.options.query,
      Options: options,
    })
  }

  const initialLabel = (): string => {
    const asset = state.assets.find((e) => e.UUID === state.assetsState.selectedAsset)
    if (asset) {
      return asset.AssetPath || ''
    }

    return state.assetsState.selectedAsset || ''
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Assets"
          grow
          labelWidth={labelWidth}
          tooltip="Specify an asset to work with, you can use regex by entering your pattern between forward slashes"
        >
          <Cascader
            initialValue={state.assetsState.selectedAsset}
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
          label="Properties"
          grow
          labelWidth={labelWidth}
          tooltip="Specify one or more asset properties to work with"
        >
          <AssetProperties
            assetProperties={state.assetProperties}
            initialValue={state.assetsState.selectedProperties.map((e) => e.value ?? '')}
            selectedAssets={matchedAssets(replacedAsset, state.assets)}
            templateVariables={templateVariables}
            onChange={onSelectProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={state.assetsState.options.query.Options}
        tags={state.assetsState.options.tags}
        appIsAlertingType={appIsAlertingType}
        datatypes={[]}
        templateVariables={templateVariables}
        onChange={handleChangeMeasurementQueryOptions}
      />
    </>
  )
}
