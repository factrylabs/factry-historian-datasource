import React from 'react'
import { MultiSelect } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Asset, AssetProperty } from 'types'

export interface Props {
  selectedAssets: Asset[]
  assetProperties: AssetProperty[]
  initialValue: string[]
  templateVariables: Array<SelectableValue<string>>
  onChange: (values: Array<SelectableValue<string>>) => void
  onOpenMenu?: () => void
}

export const AssetProperties = (props: Props): JSX.Element => {
  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    props.onChange(items)
  }

  const availableProperties = (assets: Asset[]): Array<SelectableValue<string>> => {
    const properties = props.assetProperties
      .filter((e) => assets.find((a) => a.UUID === e.AssetUUID))
      .map((e) => e.Name)
    return properties
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((e) => {
        return { label: e, value: e } as SelectableValue<string>
      })
      .concat(props.templateVariables)
  }

  // Filter out properties that don't exist in current datasource (preserves query but hides UUIDs)
  const getDisplayedValues = (assets: Asset[]): string[] => {
    const available = availableProperties(assets)
    return props.initialValue.filter(
      (value) => available.some((option) => option.value === value) || value.startsWith('$')
    )
  }

  return (
    <>
      <MultiSelect
        value={getDisplayedValues(props.selectedAssets)}
        options={availableProperties(props.selectedAssets)}
        onChange={onSelectProperties}
        onOpenMenu={props.onOpenMenu}
      />
    </>
  )
}
