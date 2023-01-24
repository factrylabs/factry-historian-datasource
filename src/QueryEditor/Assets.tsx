import React, { useState } from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader, CascaderOption } from 'components/Cascader/Cascader'
import { QueryOptions } from './QueryOptions'
import type { AssetProperty, Attributes, MeasurementQuery, Query } from 'types'

export interface Props {
  assets: CascaderOption[]
  assetProperties: AssetProperty[]
  query: Query
  measurementQuery: MeasurementQuery
  tags: any
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onUpdateTags(updatedTags: Attributes): void
  onRunQuery: () => void
}

export const Assets = ({
  assets, assetProperties, query, measurementQuery, tags,
  onChangeMeasurementQuery, onUpdateTags,
  onRunQuery
}: Props): JSX.Element => {
  const [selectedAsset, setSelectedAsset] = useState("")

  const onSelectAsset = (selected: string): void => {
    setSelectedAsset(selected)
  }

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const assetProperty = assetProperties.find(e => items.map(e => e.value).includes(e.Name))
    if (assetProperty) {
      const measurements = [assetProperty.MeasurementUUID]
      const updatedQuery = { ...measurementQuery, Measurements: measurements }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  const availableProperties = (selected: string): Array<SelectableValue<string>> => {
    return assetProperties.
      filter(e => e.AssetUUID === selected).
      map(e => { return { label: e.Name, value: e.Name } }).
      filter((value, index, self) => self.indexOf(value) === index)
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Asset" grow labelWidth={20} tooltip="Specify an asset to work with">
          <Cascader
            options={assets}
            displayAllSelectedLevels
            onSelect={onSelectAsset}
            separator='\'
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Properties" grow labelWidth={20} tooltip="Specify one or more asset properties to work with">
          <MultiSelect
            options={availableProperties(selectedAsset)}
            onChange={onSelectProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        measurementQuery={measurementQuery}
        tags={tags}
        onChangeMeasurementQuery={onChangeMeasurementQuery}
        onUpdateTags={onUpdateTags}
        onRunQuery={onRunQuery}
      />
    </div>
  )
}
