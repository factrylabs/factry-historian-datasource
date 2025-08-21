import React from 'react'
import { InlineField, InlineFieldRow, MultiSelect, RadioButtonGroup } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { Asset, AssetProperty, AssetPropertySelectionMethod, labelWidth } from 'types'
import { isUUID } from 'util/util'
import { GroupedSelectableValue, MultiComboBox } from 'components/MultiComboBox/MultiComboBox'

export interface Props {
  selectedAssets: Asset[]
  assetProperties: AssetProperty[]
  initialValue: string[]
  assetPropertySelectionMethod: AssetPropertySelectionMethod
  templateVariables: Array<SelectableValue<string>>
  onChange: (values: Array<SelectableValue<string>>) => void
  onChangePropertySelectionMethod: (method: AssetPropertySelectionMethod) => void
  onOpenMenu?: () => void
}

export const AssetProperties = (props: Props): JSX.Element => {
  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    props.onChange(items)
  }

  const availableProperties = (assets: Asset[]): Array<SelectableValue<string>> => {
    const properties = props.assetProperties
      .filter((e) => props.selectedAssets.find((a) => a.UUID === e.AssetUUID))
      .map((e) => e.Name)
    return properties
      .filter((value, index, self) => self.indexOf(value) === index)
      .map((e) => {
        return { label: e, value: e } as SelectableValue<string>
      })
      .concat(props.templateVariables)
  }

  const onChangePropertySelectionMethod = (value: string): void => {
    // Handle property selection method change
    props.onChangePropertySelectionMethod(value as AssetPropertySelectionMethod)
  }

  // Helper to group asset properties by asset
  function groupAssetPropertiesByAsset(
    selectedAssets: Asset[],
    assetProperties: AssetProperty[]
  ): Array<GroupedSelectableValue<string>> {
    const grouped: Array<GroupedSelectableValue<string>> = []
    for (const asset of selectedAssets) {
      const props = assetProperties.filter((ap) => ap.AssetUUID === asset.UUID)
      for (const prop of props) {
        grouped.push({
          label: prop.Name,
          value: prop.UUID,
          group: asset.AssetPath || asset.Name,
        })
      }
    }
    return grouped
  }

  const onChangeProps = (vals: string[]): void => {
    props.onChange(vals.map((v) => ({ label: v, value: v })))
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Properties"
          grow
          labelWidth={labelWidth}
          tooltip="Specify one or more asset properties to work with"
        >
          <>
            <RadioButtonGroup
              value={props.assetPropertySelectionMethod}
              options={[
                {
                  label: 'Per asset property',
                  value: AssetPropertySelectionMethod.PerAsset,
                },
                {
                  label: 'By name for all assets',
                  value: AssetPropertySelectionMethod.All,
                },
              ]}
              onChange={onChangePropertySelectionMethod}
            />
            {props.assetPropertySelectionMethod === AssetPropertySelectionMethod.All && (
              <MultiSelect<string>
                value={props.initialValue.map((e) => {
                  if (isUUID(e)) {
                    const property = props.assetProperties.find((ap) => ap.UUID === e)
                    return property?.Name || e
                  }
                  return e
                })}
                options={availableProperties(props.selectedAssets)}
                onChange={onSelectProperties}
                onOpenMenu={props.onOpenMenu}
              />
            )}
            {props.assetPropertySelectionMethod === AssetPropertySelectionMethod.PerAsset && (
              <MultiComboBox<string>
                options={groupAssetPropertiesByAsset(props.selectedAssets, props.assetProperties)}
                value={props.initialValue}
                onChange={onChangeProps}
                placeholder="Select asset properties..."
              />
            )}
          </>
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
