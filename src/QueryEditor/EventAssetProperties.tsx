import React, { useCallback, useEffect, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { QueryTag } from 'components/TagsSection/types'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { Asset, AssetMeasurementQuery, AssetProperty, MeasurementQueryOptions, labelWidth } from 'types'
import {
  buildLazyCascaderOptions,
  NIL_UUID,
  resolveAssetLabel,
  searchAssetsAndProperties,
  templateVariablesToCascaderOptions,
  updateTreeChildren,
  valueFiltersToQueryTags,
} from './util'
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
  const [assetOptions, setAssetOptions] = useState<CascaderOption[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])
  const [initialLabel, setInitialLabel] = useState('')

  const fetchRootAssets = useCallback(async () => {
    const rootAssets = await props.datasource.getAssets({ ParentUUIDs: [NIL_UUID] })
    const options = buildLazyCascaderOptions(rootAssets, []).concat(
      templateVariablesToCascaderOptions(props.templateVariables)
    )
    setAssetOptions(options)
  }, [props.datasource, props.templateVariables])

  const resolveInitialLabel = useCallback(async () => {
    const selectedValue = props.overrideAssets?.[0]
    const { label, asset } = await resolveAssetLabel(props.datasource, selectedValue)
    setInitialLabel(label)
    if (asset) {
      setSelectedAssets([asset])
      const properties = await props.datasource.getAssetProperties({ AssetUUIDs: [asset.UUID] })
      setAssetProperties(properties)
    }
  }, [props.overrideAssets, props.datasource])

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
        setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, childAssetOptions.concat(propertyOptions)))
      }).catch(() => {})
    },
    [props.datasource]
  )

  const handleSearchAsync = useCallback(
    (keyword: string) => searchAssetsAndProperties(props.datasource, keyword),
    [props.datasource]
  )

  const onAssetChange = async (asset: string, property?: string): Promise<void> => {
    if (!isUUID(asset) && !isRegex(asset) && !props.templateVariables.some((e) => e.value === asset)) {
      if (!props.overrideAssets || props.overrideAssets.length === 0) {
        return
      }

      props.onChangeAssetMeasurementQuery({
        AssetProperties: [],
        Assets: [],
        Options: props.queryOptions,
      })
      setSelectedAssets([])
      setAssetProperties([])
      return
    }

    const [assetProps, resolvedAssets] = await Promise.all([
      props.datasource.getAssetProperties({ AssetUUIDs: [asset] }),
      isUUID(asset) ? props.datasource.getAssets({ Keyword: asset }) : Promise.resolve([]),
    ])
    setAssetProperties(assetProps)

    if (isUUID(asset)) {
      setSelectedAssets(resolvedAssets.filter((a) => a.UUID === asset))
    }

    let properties: string[] = []
    if (property) {
      const assetProperty = assetProps.find((e) => e.UUID === property)
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
    const selectedAssetPropertyNames = props.selectedAssetProperties.flatMap((e) =>
      props.datasource.multiSelectReplace(e, {})
    )

    for (const assetProperty of assetProperties) {
      const propertySelected =
        selectedAssetPropertyNames.find((e) => e === assetProperty.UUID || e === assetProperty.Name) !== undefined

      const assetSelected = selectedAssets.find((e) => e.UUID === assetProperty.AssetUUID)
      if (propertySelected && assetSelected) {
        assetPropertiesSet.add(assetProperty)
      }
    }

    return Array.from(assetPropertiesSet)
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
                initialLabel={initialLabel}
                options={assetOptions}
                displayAllSelectedLevels
                onSelect={onAssetChange}
                separator="\\"
                onOpen={() => { if (assetOptions.length === 0) { fetchRootAssets() } }}
                loadData={handleLoadData}
                onSearchAsync={handleSearchAsync}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Asset properties" labelWidth={labelWidth} grow>
              <AssetProperties
                assetProperties={assetProperties}
                initialValue={props.selectedAssetProperties}
                selectedAssets={selectedAssets}
                templateVariables={props.templateVariables}
                onChange={onChangeAssetProperties}
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
