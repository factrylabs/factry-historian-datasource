import React, { useEffect, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { QueryTag } from 'components/TagsSection/types'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { Asset, AssetProperty, MeasurementQueryOptions, labelWidth } from 'types'
import { valueFiltersToQueryTags } from './util'

export interface Props {
  datasource: DataSource
  seriesLimit: number
  selectedAssets: Asset[]
  selectedAssetProperties: string[]
  queryType: string
  queryOptions: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  onChangeAssetProperties: (assetProperties: string[]) => void
  onChangeQueryOptions: (options: MeasurementQueryOptions) => void
  onChangeSeriesLimit: (value: number) => void
}

export const EventAssetProperties = (props: Props): React.JSX.Element => {
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])

  useEffect(() => {
    const load = async () => {
      const result = await props.datasource.getAssetProperties()
      setAssetProperties(result)
    }
    load()
  }, [props.datasource])

  const onChangeAssetProperties = (items: Array<SelectableValue<string>>): void => {
    const selectedAssetProperties = items.map((e) => e.value ?? '')
    props.onChangeAssetProperties(selectedAssetProperties)
  }

  const getTagKeyOptions = async (): Promise<string[]> => {
    let options = new Set<string>()

    for (const assetProperty of getSelectedAssetProperties()) {
      const keys = await props.datasource.getTagKeysForMeasurement(assetProperty.MeasurementUUID)
      keys.forEach((e) => options.add(e))
    }

    return Array.from(options)
  }

  const getTagValueOptions = async (key: string): Promise<string[]> => {
    let options = new Set<string>()

    for (const assetProperty of getSelectedAssetProperties()) {
      const values = await props.datasource.getTagValuesForMeasurement(assetProperty.MeasurementUUID, key)
      values.forEach((e) => options.add(e))
    }

    return Array.from(options)
  }

  const getSelectedAssetProperties = (): AssetProperty[] => {
    const assetPropertiesSet = new Set<AssetProperty>()
    const selectedAssetProperties = props.selectedAssetProperties.flatMap((e) =>
      props.datasource.multiSelectReplace(e, {})
    )

    for (const assetProperty of assetProperties) {
      const propertySelected =
        selectedAssetProperties.find((e) => e === assetProperty.UUID || e === assetProperty.Name) !== undefined

      const assetSelected = props.selectedAssets.find((e) => e.UUID === assetProperty.AssetUUID)
      if (propertySelected && assetSelected) {
        assetPropertiesSet.add(assetProperty)
      }
    }

    return Array.from(assetPropertiesSet)
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Asset properties" labelWidth={labelWidth} grow>
          <AssetProperties
            assetProperties={assetProperties}
            initialValue={props.selectedAssetProperties}
            selectedAssets={props.selectedAssets}
            templateVariables={props.templateVariables}
            onChange={onChangeAssetProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={props.queryOptions}
        seriesLimit={props.seriesLimit}
        tags={props.tags}
        valueFilters={valueFiltersToQueryTags(props.queryOptions.ValueFilters ?? [])}
        appIsAlertingType={props.appIsAlertingType}
        datatypes={[]}
        templateVariables={props.templateVariables}
        hideInterval={props.queryType === 'simple'}
        hideFill={props.queryType === 'simple'}
        hideLimit={props.queryType === 'simple'}
        hideGroupBy={props.queryType === 'simple'}
        hideAdvancedOptions={props.queryType === 'simple'}
        historianVersion={props.datasource.historianInfo?.Version ?? ''}
        getTagKeyOptions={getTagKeyOptions}
        getTagValueOptions={getTagValueOptions}
        onChange={props.onChangeQueryOptions}
        onChangeSeriesLimit={props.onChangeSeriesLimit}
      />
    </>
  )
}
