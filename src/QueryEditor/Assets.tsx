import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader } from 'components/Cascader/Cascader'
import { QueryOptions } from './QueryOptions'
import type { MeasurementQuery, MeasurementQueryState, State } from 'types'

export interface Props {
  state: State
  saveState(state: State): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onRunQuery: () => void
}

export const Assets = ({
  state, saveState,
  onChangeMeasurementQuery,
  onRunQuery
}: Props): JSX.Element => {
  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const selectedAssetProperties = state.assetProperties.filter(e => items.map(e => e.value).includes(e.Name))
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
    onRunQuery()
  }

  const availableProperties = (selected: string | undefined): Array<SelectableValue<string>> => {
    return state.assetProperties.
      filter(e => e.AssetUUID === selected).
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
        }
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
            initialValue={state.assetsState.queryOptions.filter.Asset}
            options={state.assets}
            displayAllSelectedLevels
            onSelect={onAssetChange}
            separator='\'
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Properties" grow labelWidth={20} tooltip="Specify one or more asset properties to work with">
          <MultiSelect
            value={state.assetsState.selectedProperties}
            options={availableProperties(state.assetsState.queryOptions.filter.Asset)}
            onChange={onSelectProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={state.assetsState.queryOptions}
        onChange={handleChangeMeasurementQuery}
        onRunQuery={onRunQuery}
      />
    </div>
  )
}
