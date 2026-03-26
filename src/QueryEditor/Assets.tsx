import React, { useCallback, useEffect, useState } from 'react'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'
import { default as Cascader, CascaderOption } from 'components/Cascader/Cascader'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { buildLazyCascaderOptions, matchedAssets, tagsToQueryTags, updateTreeChildren, valueFiltersToQueryTags } from './util'
import { Asset, AssetMeasurementQuery, AssetProperty, labelWidth, MeasurementQueryOptions } from 'types'
import { isFeatureEnabled } from 'util/semver'
import { isRegex, isUUID } from 'util/util'

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

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
  const [assetOptions, setAssetOptions] = useState<CascaderOption[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])
  const [initialLabel, setInitialLabel] = useState('')

  const fetchRootAssets = useCallback(async () => {
    const rootAssets = await props.datasource.getAssets({ ParentUUIDs: [NIL_UUID] })
    const rootUUIDs = rootAssets.map((a) => a.UUID)
    const rootProperties = rootUUIDs.length > 0
      ? await props.datasource.getAssetProperties({ AssetUUIDs: rootUUIDs })
      : []
    const options = buildLazyCascaderOptions(rootAssets, rootProperties).concat(
      props.templateVariables.map((e) => ({
        value: e.value,
        label: e.label ?? '',
        isLeaf: true,
      }))
    )
    setAssetOptions(options)
  }, [props.datasource, props.templateVariables])

  const resolveInitialLabel = useCallback(async () => {
    if (!props.query.Assets || props.query.Assets.length === 0) {
      setInitialLabel('')
      return
    }

    const selectedValue = props.query.Assets[0]

    if (selectedValue.startsWith('$')) {
      setInitialLabel(selectedValue)
      return
    }

    if (isUUID(selectedValue)) {
      const assets = await props.datasource.getAssets({ Keyword: selectedValue })
      const asset = assets.find((a) => a.UUID === selectedValue)
      if (asset) {
        setInitialLabel(asset.AssetPath || asset.Name)

        // Also load properties for the selected asset
        const matched = [asset]
        setSelectedAssets(matched)
        const properties = await props.datasource.getAssetProperties({ AssetUUIDs: [asset.UUID] })
        setAssetProperties(properties)
      } else {
        setInitialLabel('')
      }
      return
    }

    setInitialLabel('')
  }, [props.query.Assets, props.datasource])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        await Promise.all([fetchRootAssets(), resolveInitialLabel()])
        setLoading(false)
      })()
    }
  }, [loading, fetchRootAssets, resolveInitialLabel])

  const handleLoadData = useCallback(
    (selectOptions: CascaderOption[]) => {
      const targetOption = selectOptions[selectOptions.length - 1]
      const parentUUID = targetOption.value

      // Skip if children are already loaded (non-leaf items present)
      if (targetOption.items?.some((item) => !item.isLeaf)) {
        return
      }

      Promise.all([
        props.datasource.getAssets({ ParentUUIDs: [parentUUID] }),
        props.datasource.getAssetProperties({ AssetUUIDs: [parentUUID] }),
      ]).then(([children, properties]) => {
        const childAssetOptions = buildLazyCascaderOptions(children, [])
        const propertyOptions: CascaderOption[] = properties.map((prop) => ({
          label: `📏 ${prop.Name}`,
          value: prop.UUID,
          isLeaf: true,
        }))
        const allItems = childAssetOptions.concat(propertyOptions)
        setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, allItems))
      })
    },
    [props.datasource]
  )

  const handleSearchAsync = useCallback(
    async (keyword: string): Promise<Array<SelectableValue<string[]>>> => {
      if (!keyword || keyword.length < 2) {
        return []
      }
      const [assets, properties] = await Promise.all([
        props.datasource.getAssets({ Keyword: keyword, UseAssetPath: true }),
        props.datasource.getAssetProperties({ Keyword: keyword }),
      ])

      // Filter properties to only those whose name matches the keyword
      const matchedProperties = properties.filter((prop) =>
        prop.Name.toLowerCase().includes(keyword.toLowerCase())
      )

      // Fetch parent assets for properties whose parent wasn't in the keyword search results
      const assetMap = new Map(assets.map((a) => [a.UUID, a]))
      const missingParentUUIDs = [...new Set(
        matchedProperties.map((p) => p.AssetUUID).filter((uuid) => !assetMap.has(uuid))
      )]
      if (missingParentUUIDs.length > 0) {
        const parentAssets = await props.datasource.getAssets({ UUIDs: missingParentUUIDs })
        for (const asset of parentAssets) {
          assetMap.set(asset.UUID, asset)
        }
      }

      const assetResults: Array<SelectableValue<string[]>> = assets.map((asset) => ({
        label: `📦 ${asset.AssetPath || asset.Name}`,
        value: [asset.UUID],
      }))

      const propertyResults: Array<SelectableValue<string[]>> = matchedProperties.map((prop) => {
        const parentAsset = assetMap.get(prop.AssetUUID)
        const parentLabel = parentAsset?.AssetPath || parentAsset?.Name || ''
        return {
          label: `${parentLabel ? '📦 ' + parentLabel + '\\' : ''}📏 ${prop.Name}`,
          value: [prop.AssetUUID, prop.UUID],
          description: parentLabel,
        }
      })

      return assetResults.concat(propertyResults)
    },
    [props.datasource]
  )

  const onSelectProperties = (items: Array<SelectableValue<string>>): void => {
    const properties = items.map((e) => e.value ?? '')
    props.onChangeAssetMeasurementQuery({
      ...props.query,
      AssetProperties: properties,
    })
  }

  const onAssetChange = async (asset: string, property?: string): Promise<void> => {
    if (!isUUID(asset) && !isRegex(asset) && !props.templateVariables.some((e) => e.value === asset)) {
      if (!props.query.Assets || props.query.Assets.length === 0) {
        return
      }

      props.onChangeAssetMeasurementQuery({
        ...props.query,
        AssetProperties: [],
        Assets: [],
      })
      setSelectedAssets([])
      setAssetProperties([])
      return
    }

    let properties: string[] = []
    if (property) {
      // Fetch the property details to get its name
      const allProps = await props.datasource.getAssetProperties({ AssetUUIDs: [asset] })
      const assetProperty = allProps.find((e) => e.UUID === property)
      if (assetProperty) {
        properties = [assetProperty.Name]
      }
      setAssetProperties(allProps)
    } else {
      // Fetch properties for the selected asset
      const assetProps = await props.datasource.getAssetProperties({ AssetUUIDs: [asset] })
      setAssetProperties(assetProps)
    }

    // Resolve selected asset(s) for the properties multiselect
    if (isUUID(asset)) {
      const assets = await props.datasource.getAssets({ Keyword: asset })
      setSelectedAssets(assets.filter((a) => a.UUID === asset))
    } else if (isRegex(asset)) {
      const assets = await props.datasource.getAssets({ Keyword: asset })
      setSelectedAssets(matchedAssets(props.datasource.multiSelectReplace(asset), assets))
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

  const getSelectedAssetProperties = (): AssetProperty[] => {
    const resultingAssetProperties = new Set<AssetProperty>()
    const selectedAssetPropertyNames = props.query.AssetProperties?.flatMap((e) => props.datasource.multiSelectReplace(e))
    const selectedAssetUUIDs = selectedAssets.map((a) => a.UUID)

    for (const assetProperty of assetProperties) {
      const propertySelected =
        selectedAssetPropertyNames?.find((e) => e === assetProperty.UUID || e === assetProperty.Name) !== undefined

      const assetSelected = selectedAssetUUIDs.find((e) => e === assetProperty.AssetUUID)
      if (propertySelected && assetSelected) {
        resultingAssetProperties.add(assetProperty)
      }
    }
    return Array.from(resultingAssetProperties)
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
                initialLabel={initialLabel}
                options={assetOptions}
                displayAllSelectedLevels
                onSelect={onAssetChange}
                separator="\\"
                onOpen={fetchRootAssets}
                loadData={handleLoadData}
                onSearchAsync={handleSearchAsync}
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
                selectedAssets={selectedAssets}
                templateVariables={props.templateVariables}
                onChange={onSelectProperties}
                onOpenMenu={async () => {
                  if (selectedAssets.length > 0) {
                    const props2 = await props.datasource.getAssetProperties({
                      AssetUUIDs: selectedAssets.map((a) => a.UUID),
                    })
                    setAssetProperties(props2)
                  }
                }}
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
