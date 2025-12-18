import React, { useCallback, useEffect, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { QueryTag } from 'components/TagsSection/types'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { Asset, AssetMeasurementQuery, AssetProperty, MeasurementQueryOptions, labelWidth } from 'types'
import { getChildAssets, valueFiltersToQueryTags } from './util'
import { isFeatureEnabled } from 'util/semver'
import Cascader, { CascaderOption } from 'components/Cascader/Cascader'
import { isRegex, isUUID } from 'util/util'

export interface Props {
  datasource: DataSource
  seriesLimit: number
  selectedAssets: Asset[]
  overrideAssets: string[]
  selectedAssetProperties: string[]
  queryType: string
  queryOptions: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  onChangeAssetMeasurementQuery: (query: AssetMeasurementQuery) => void
  onChangeSeriesLimit: (value: number) => void
  onOpenMenu?: () => void
}

export const EventAssetProperties = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<Asset[]>([])
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])

  const fetchAssetsAndProperties = useCallback(async () => {
    const assets = await props.datasource.getAssets()
    setAssets(assets)
    const assetProperties = await props.datasource.getAssetProperties()
    setAssetProperties(assetProperties)
  }, [props.datasource])

  useEffect(() => {
    if (loading) {
      ; (async () => {
        await fetchAssetsAndProperties()
        setLoading(false)
      })()
    }
  }, [loading, fetchAssetsAndProperties])

  const assetOptions = getChildAssets(null, assets, assetProperties).concat(
    props.templateVariables.map((e) => {
      return { value: e.value, label: e.label } as CascaderOption
    })
  )

  const onAssetChange = (asset: string, property?: string): void => {
    if (!isUUID(asset) && !isRegex(asset) && !props.templateVariables.some((e) => e.value === asset)) {
      if (!props.overrideAssets || props.overrideAssets.length === 0) {
        return
      }

      props.onChangeAssetMeasurementQuery({
        AssetProperties: [],
        Assets: [],
        Options: props.queryOptions,
      })
      return
    }

    let properties: string[] = []
    if (property) {
      const assetProperty = assetProperties.find((e) => e.UUID === property)
      if (assetProperty) {
        properties = [assetProperty.Name]
      }
    }

    props.onChangeAssetMeasurementQuery({
      AssetProperties: properties,
      Assets: [asset],
      Options: props.queryOptions,
    })
  }

  const onChangeAssetProperties = (items: Array<SelectableValue<string>>): void => {
    const selectedAssetProperties = items.map((e) => e.value ?? '')
    props.onChangeAssetMeasurementQuery({
      AssetProperties: selectedAssetProperties,
      Assets: props.overrideAssets,
      Options: props.queryOptions,
    })
  }

  const onChangeQueryOptions = (options: MeasurementQueryOptions): void => {
    props.onChangeAssetMeasurementQuery({
      AssetProperties: props.selectedAssetProperties,
      Assets: props.overrideAssets,
      Options: options,
    })
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

  const initialLabel = (): string => {
    if (!props.overrideAssets || props.overrideAssets.length === 0) {
      return ''
    }

    const asset = assets.find((e) => e.UUID === props.overrideAssets[0])
    if (asset) {
      return asset.AssetPath || ''
    }

    return props.overrideAssets[0]
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Override assets"
              grow
              labelWidth={labelWidth}
              tooltip="Specify an asset to work with, you can use regex by entering your pattern between forward slashes. Leave empty to use the asset(s) from the event query"
            >
              <Cascader
                initialValue={props.overrideAssets?.length ? props.overrideAssets[0] : ''}
                initialLabel={initialLabel()}
                options={assetOptions}
                displayAllSelectedLevels
                onSelect={onAssetChange}
                separator="\\"
                onOpen={fetchAssetsAndProperties}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Asset properties" labelWidth={labelWidth} grow>
              <AssetProperties
                assetProperties={assetProperties}
                initialValue={props.selectedAssetProperties}
                selectedAssets={props.selectedAssets}
                templateVariables={props.templateVariables}
                onChange={onChangeAssetProperties}
                onOpenMenu={props.onOpenMenu}
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
            aggregationRequired={true}
            historianVersion={props.datasource.historianInfo?.Version ?? ''}
            getTagKeyOptions={getTagKeyOptions}
            getTagValueOptions={getTagValueOptions}
            onChange={onChangeQueryOptions}
            onChangeSeriesLimit={props.onChangeSeriesLimit}
            hideDatatypeFilter={!isFeatureEnabled(props.datasource.historianInfo?.Version ?? '', '7.3.0')}
          />
        </>
      )}
    </>
  )
}
