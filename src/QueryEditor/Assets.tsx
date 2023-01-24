import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Cascader, CascaderOption } from 'components/Cascader/Cascader'
import { QueryOptions } from './QueryOptions'
import type { AssetProperty, Attributes, MeasurementFilter, MeasurementQuery } from 'types'

export interface Props {
  assets: CascaderOption[]
  assetProperties: AssetProperty[]
  filter: MeasurementFilter
  measurementQuery: MeasurementQuery
  tags: any
  selectedProperties: Array<SelectableValue<string>>
  onChangeMeasurementQuery: (query: MeasurementQuery, selectedProperties?: Array<SelectableValue<string>>) => void
  onUpdateTags(updatedTags: Attributes): void
  onRunQuery: () => void
  onAssetChange(value: string): void
}

export const Assets = ({
  assets, assetProperties, filter, measurementQuery, tags, selectedProperties,
  onChangeMeasurementQuery, onUpdateTags, onAssetChange,
  onRunQuery
}: Props): JSX.Element => {
  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const assetProperty = assetProperties.find(e => items.map(e => e.value).includes(e.Name))
    if (assetProperty) {
      const measurements = [assetProperty.MeasurementUUID]
      const updatedQuery = { ...measurementQuery, Measurements: measurements }
      onChangeMeasurementQuery(updatedQuery, items)
      onRunQuery()
    }
  }

  const availableProperties = (selected: string | undefined): Array<SelectableValue<string>> => {
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
            initialValue={filter.Asset}
            options={assets}
            displayAllSelectedLevels
            onSelect={onAssetChange}
            separator='\'
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Properties" grow labelWidth={20} tooltip="Specify one or more asset properties to work with">
          <MultiSelect
            value={selectedProperties}
            options={availableProperties(filter.Asset)}
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
