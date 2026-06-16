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
  eagerAssetLabel,
  fetchLazyChildOptions,
  getChildAssets,
  isLazyLoadingEnabled,
  matchedAssets,
  NIL_UUID,
  resolveAssetLabel,
  resolveSelectedAssets,
  searchAssetsAndProperties,
  templateVariablesToCascaderOptions,
  updateTreeChildren,
  valueFiltersToQueryTags,
} from './util'
import { isFeatureEnabled } from 'util/semver'
import Cascader, { CascaderOption } from 'components/Cascader/Cascader'
import { isRegex, isUUID } from 'util/util'
import { notifyError } from 'util/notify'

export interface Props {
  datasource: DataSource
  seriesLimit: number | string
  overrideAssets: string[]
  selectedAssetProperties: string[]
  queryType: string
  queryOptions: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  onChangeAssetMeasurementQuery: (query: AssetMeasurementQuery) => void
  onChangeSeriesLimit: (value: number | string) => void
}

export const EventAssetProperties = (props: Props): JSX.Element => {
  const lazyEnabled = isLazyLoadingEnabled(props.datasource.historianInfo?.Version ?? '')

  const [loading, setLoading] = useState(true)
  const [assetOptions, setAssetOptions] = useState<CascaderOption[]>([])
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])
  const [initialLabel, setInitialLabel] = useState('')
  // Full asset list, only populated in the eager (pre-v8.2.0) fallback.
  const [allAssets, setAllAssets] = useState<Asset[]>([])

  const fetchRootAssets = useCallback(async () => {
    const rootAssets = await props.datasource.getAssets({
      ParentUUIDs: [NIL_UUID],
      IncludeHasChildren: true,
      IncludeHasAssetProperties: true,
    })
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

  const fetchAssetsAndProperties = useCallback(async () => {
    const [assets, properties] = await Promise.all([
      props.datasource.getAssets(),
      props.datasource.getAssetProperties(),
    ])
    setAllAssets(assets)
    setAssetProperties(properties)
    setAssetOptions(
      getChildAssets(null, assets, properties).concat(templateVariablesToCascaderOptions(props.templateVariables))
    )
    const selectedValue = props.overrideAssets?.[0]
    setSelectedAssets(matchedAssets(props.datasource.multiSelectReplace(selectedValue ?? ''), assets))
    setInitialLabel(eagerAssetLabel(selectedValue, assets))
  }, [props.datasource, props.templateVariables, props.overrideAssets])

  useEffect(() => {
    if (loading) {
      ;(async () => {
        if (lazyEnabled) {
          await Promise.all([fetchRootAssets(), resolveInitialLabel()])
        } else {
          await fetchAssetsAndProperties()
        }
        setLoading(false)
      })()
    }
  }, [loading, lazyEnabled, fetchRootAssets, resolveInitialLabel, fetchAssetsAndProperties])

  const handleLoadData = useCallback(
    (selectOptions: CascaderOption[]) => {
      const targetOption = selectOptions[selectOptions.length - 1]
      const parentUUID = targetOption.value

      // Already loaded (or known leaf): don't refetch on every expand.
      if (targetOption.isLeaf || (targetOption.items && targetOption.items.length > 0)) {
        return
      }

      fetchLazyChildOptions(props.datasource, parentUUID, true)
        .then((children) => setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, children)))
        .catch((error) => {
          // Clear the node's loading state so the cascader spinner stops.
          setAssetOptions((prev) => updateTreeChildren(prev, parentUUID, []))
          notifyError('Failed to load child assets or properties', error)
        })
    },
    [props.datasource]
  )

  const handleSearchAsync = useCallback(
    (keyword: string) => searchAssetsAndProperties(props.datasource, keyword),
    [props.datasource]
  )

  const applyAssetChange = async (asset: string, property?: string): Promise<void> => {
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
      if (lazyEnabled) {
        setAssetProperties([])
      }
      return
    }

    let availableProperties: AssetProperty[]
    if (lazyEnabled) {
      // Resolve the selection to concrete assets first (UUID, regex match, or
      // template expansion), then fetch the properties of those assets.
      const resolvedAssets = await resolveSelectedAssets(props.datasource, asset)
      setSelectedAssets(resolvedAssets)

      const assetProps =
        resolvedAssets.length > 0
          ? await props.datasource.getAssetProperties({ AssetUUIDs: resolvedAssets.map((a) => a.UUID) })
          : []
      setAssetProperties(assetProps)
      availableProperties = assetProps
    } else {
      // Eager fallback: everything is already loaded, match against the full list.
      availableProperties = assetProperties
      setSelectedAssets(matchedAssets(props.datasource.multiSelectReplace(asset), allAssets))
    }

    let properties: string[] = []
    if (property) {
      const assetProperty = availableProperties.find((e) => e.UUID === property)
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

  // The Cascader's onSelect expects a void handler, so kick off the async work
  // and log any rejection instead of letting it surface as an unhandled rejection.
  const onAssetChange = (asset: string, property?: string): void => {
    applyAssetChange(asset, property).catch((error) => {
      notifyError('Failed to handle asset selection', error)
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

  const handleOpen = (): void => {
    if (lazyEnabled) {
      if (assetOptions.length === 0) {
        fetchRootAssets()
      }
      return
    }
    fetchAssetsAndProperties()
  }

  const handleOpenPropertiesMenu = async (): Promise<void> => {
    if (!lazyEnabled) {
      fetchAssetsAndProperties()
      return
    }
    if (selectedAssets.length > 0) {
      const properties = await props.datasource.getAssetProperties({
        AssetUUIDs: selectedAssets.map((a) => a.UUID),
      })
      setAssetProperties(properties)
    }
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
                onOpen={handleOpen}
                loadData={lazyEnabled ? handleLoadData : undefined}
                onSearchAsync={lazyEnabled ? handleSearchAsync : undefined}
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
                onOpenMenu={handleOpenPropertiesMenu}
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
