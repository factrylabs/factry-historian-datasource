import React, { useCallback, useEffect, useState } from 'react'
import { CascaderOption, InlineField, InlineFieldRow } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { default as Cascader } from 'components/Cascader/Cascader'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { getChildAssets, matchedAssets, tagsToQueryTags, valueFiltersToQueryTags } from './util'
import { Asset, AssetMeasurementQuery, AssetProperty, labelWidth, MeasurementQueryOptions } from 'types'
import { isFeatureEnabled } from 'util/semver'
import { isRegex, isUUID } from 'util/util'

export interface Props {
  query: AssetMeasurementQuery
  seriesLimit: number
  datasource: DataSource
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  onChangeAssetMeasurementQuery: (query: AssetMeasurementQuery) => void
  onChangeSeriesLimit: (value: number) => void
}

export const Assets = (props: Props): JSX.Element => {
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
      ;(async () => {
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

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const assetProperties = items.map((e) => e.value ?? '')
    props.onChangeAssetMeasurementQuery({
      ...props.query,
      AssetProperties: assetProperties,
    })
  }

  const onAssetChange = (asset: string, property?: string): void => {
    if (!isUUID(asset) && !isRegex(asset) && !props.templateVariables.some((e) => e.value === asset)) {
      if (!props.query.Assets || props.query.Assets.length === 0) {
        return
      }

      props.onChangeAssetMeasurementQuery({
        ...props.query,
        AssetProperties: [],
        Assets: [],
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
      ...props.query,
      AssetProperties: properties,
      Assets: [asset],
    })
  }

  const handleChangeMeasurementQueryOptions = (options: MeasurementQueryOptions): void => {
    props.onChangeAssetMeasurementQuery({
      ...props.query,
      Options: options,
    })
  }

  const initialLabel = (): string => {
    if (!props.query.Assets || props.query.Assets.length === 0) {
      return ''
    }

    const asset = assets.find((e) => e.UUID === props.query.Assets[0])
    if (asset) {
      return asset.AssetPath || ''
    }

    return props.query.Assets[0]
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
    const resultingAssetProperties = new Set<AssetProperty>()
    const selectedAssetProperties = props.query.AssetProperties?.flatMap((e) => props.datasource.multiSelectReplace(e))
    const selectedAssets = props.query.Assets.flatMap((e) =>
      matchedAssets(props.datasource.multiSelectReplace(e), assets).map((asset) => asset.UUID)
    )

    for (const assetProperty of assetProperties) {
      const propertySelected =
        selectedAssetProperties?.find((e) => e === assetProperty.UUID || e === assetProperty.Name) !== undefined

      const assetSelected = selectedAssets.find((e) => e === assetProperty.AssetUUID)
      if (propertySelected && assetSelected) {
        resultingAssetProperties.add(assetProperty)
      }
    }
    return Array.from(resultingAssetProperties)
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Assets"
              grow
              labelWidth={labelWidth}
              tooltip="Specify an asset to work with, you can use regex by entering your pattern between forward slashes"
            >
              <Cascader
                initialValue={props.query.Assets?.length ? props.query.Assets[0] : ''}
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
            <InlineField
              label="Properties"
              grow
              labelWidth={labelWidth}
              tooltip="Specify one or more asset properties to work with"
            >
              <AssetProperties
                assetProperties={assetProperties}
                initialValue={props.query.AssetProperties ?? []}
                selectedAssets={matchedAssets(
                  props.datasource.multiSelectReplace(props.query.Assets?.length ? props.query.Assets[0] : ''),
                  assets
                )}
                templateVariables={props.templateVariables}
                onChange={onSelectProperties}
                onOpenMenu={fetchAssetsAndProperties}
              />
            </InlineField>
          </InlineFieldRow>
          <QueryOptions
            state={props.query.Options}
            seriesLimit={props.seriesLimit}
            tags={tagsToQueryTags(props.query.Options.Tags)}
            valueFilters={valueFiltersToQueryTags(props.query.Options.ValueFilters ?? [])}
            appIsAlertingType={props.appIsAlertingType}
            datatypes={[]}
            historianVersion={props.datasource.historianInfo?.Version ?? ''}
            templateVariables={props.templateVariables}
            getTagKeyOptions={getTagKeyOptions}
            getTagValueOptions={getTagValueOptions}
            onChange={handleChangeMeasurementQueryOptions}
            onChangeSeriesLimit={props.onChangeSeriesLimit}
            hideDatatypeFilter={!isFeatureEnabled(props.datasource.historianInfo?.Version ?? '', '7.3.0')}
          />
        </>
      )}
    </>
  )
}
