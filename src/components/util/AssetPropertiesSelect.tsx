import React from 'react'
import { MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { matchedAssets } from 'QueryEditor/util'
import { Asset, AssetProperty } from 'types'

export interface Props {
  selectedAssets: Asset[]
  assetProperties: AssetProperty[]
  initialValue: string[]
  templateVariables: Array<SelectableValue<string>>
  onChange: (values: Array<SelectableValue<string>>) => void
}

export const AssetProperties = (props: Props): JSX.Element => {
  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    props.onChange(items)
  }

  const availableProperties = (assets: Asset[]): Array<SelectableValue<string>> => {
    const properties = props.assetProperties
      .filter((e) => matchedAssets(e.AssetUUID, assets).find((a) => a.UUID === e.AssetUUID))
      .map((e) => e.Name)
    return properties
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((e) => {
        return { label: e, value: e } as SelectableValue<string>
      })
      .concat(props.templateVariables)
  }

  return (
    <>
      <MultiSelect
        value={props.initialValue}
        options={availableProperties(props.selectedAssets)}
        onChange={onSelectProperties}
        allowCustomValue
        createOptionPosition="first"
      />
    </>
  )
}
