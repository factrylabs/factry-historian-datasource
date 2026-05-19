import { SelectableValue } from '@grafana/data'
import { CascaderOption } from 'components/Cascader/Cascader'
import { QueryTag } from 'components/TagsSection/TagsSection'
import { useEffect, useState } from 'react'
import {
  AggregationName,
  Asset,
  AssetProperty,
  Attributes,
  EventPropertyFilter,
  EventType,
  EventTypeProperty,
  FillType,
  Measurement,
  MeasurementQuery,
  MeasurementQueryOptions,
  PropertyDatatype,
  ValueFilter,
} from 'types'
import { DataSource } from 'datasource'
import { isFeatureEnabled } from 'util/semver'
import { isRegex, isUUID } from 'util/util'

export const NIL_UUID = '00000000-0000-0000-0000-000000000000'

// Lazy loading of the asset tree relies on GET /assets features added in
// historian v8.2.0 (nil-UUID ParentUUIDs sentinel for roots, IncludeHasChildren
// and IncludeHasAssetProperties). On older historians we fall back to eagerly
// loading the full asset tree.
export const LAZY_LOADING_MIN_VERSION = '8.2.0'

export function isLazyLoadingEnabled(version: string): boolean {
  // Unknown version (info not loaded or unreachable): take the eager fallback,
  // it works on every historian. Non-semver debug builds still count as newest.
  if (!version) {
    return false
  }
  return isFeatureEnabled(version, LAZY_LOADING_MIN_VERSION)
}

// Resolves the cascader label for a selected asset from an already-loaded
// asset list (eager, pre-v8.2.0 path). Matches resolveAssetLabel behaviour:
// falls back to Name when no AssetPath, keeps template variables and regex
// visible, hides UUIDs from other datasources.
export function eagerAssetLabel(selectedValue: string | undefined, assets: Asset[]): string {
  if (!selectedValue) {
    return ''
  }
  const asset = assets.find((e) => e.UUID === selectedValue)
  if (asset) {
    return asset.AssetPath || asset.Name
  }
  if (selectedValue.startsWith('$') || isRegex(selectedValue)) {
    return selectedValue
  }
  return ''
}

export function templateVariablesToCascaderOptions(
  templateVariables: Array<SelectableValue<string>>
): CascaderOption[] {
  return templateVariables.map((e) => ({
    value: e.value,
    label: e.label ?? '',
    isLeaf: true,
  }))
}

export async function resolveAssetLabel(
  datasource: DataSource,
  selectedValue: string | undefined
): Promise<{ label: string; asset?: Asset }> {
  if (!selectedValue) {
    return { label: '' }
  }

  // Keep template variables and regex visible in the input.
  if (selectedValue.startsWith('$') || isRegex(selectedValue)) {
    return { label: selectedValue }
  }

  if (isUUID(selectedValue)) {
    const results = await datasource.getAssets({ UUIDs: [selectedValue] })
    const asset = results.find((a) => a.UUID === selectedValue)
    if (asset) {
      return { label: asset.AssetPath || asset.Name, asset }
    }
  }

  return { label: '' }
}

export async function searchAssetsAndProperties(
  datasource: DataSource,
  keyword: string,
  includeProperties = true
): Promise<Array<SelectableValue<string[]>>> {
  if (!keyword || keyword.length < 2) {
    return []
  }

  const [assets, properties] = await Promise.all([
    datasource.getAssets({ Keyword: keyword, UseAssetPath: true }),
    includeProperties ? datasource.getAssetProperties({ Keyword: keyword }) : Promise.resolve([]),
  ])

  // Properties come back already keyword-filtered by the backend (regex match on
  // name when the keyword is a regex, ILIKE on name/description otherwise), so
  // they are used as-is.
  const assetMap = new Map(assets.map((a) => [a.UUID, a]))
  const missingParentUUIDs = [...new Set(properties.map((p) => p.AssetUUID).filter((uuid) => !assetMap.has(uuid)))]
  if (missingParentUUIDs.length > 0) {
    const parentAssets = await datasource.getAssets({ UUIDs: missingParentUUIDs })
    for (const asset of parentAssets) {
      assetMap.set(asset.UUID, asset)
    }
  }

  const assetResults: Array<SelectableValue<string[]>> = assets.map((asset) => ({
    label: `📦 ${asset.AssetPath || asset.Name}`,
    value: [asset.UUID],
  }))

  const propertyResults: Array<SelectableValue<string[]>> = properties.map((prop) => {
    const parentAsset = assetMap.get(prop.AssetUUID)
    const parentLabel = parentAsset?.AssetPath || parentAsset?.Name || ''
    return {
      label: `${parentLabel ? '📦 ' + parentLabel + '\\' : ''}📏 ${prop.Name}`,
      value: [prop.AssetUUID, prop.UUID],
      description: parentLabel,
    }
  })

  return assetResults.concat(propertyResults)
}

// Resolves a cascader selection (UUID, regex, or template variable) to the
// concrete assets it refers to (lazy, >= v8.2.0 path).
export async function resolveSelectedAssets(datasource: DataSource, asset: string): Promise<Asset[]> {
  if (isUUID(asset)) {
    return (await datasource.getAssets({ UUIDs: [asset] })).filter((a) => a.UUID === asset)
  }
  if (isRegex(asset)) {
    const candidates = await datasource.getAssets({ Keyword: asset })
    return matchedAssets(datasource.multiSelectReplace(asset), candidates)
  }
  // Template variable: expand to UUIDs.
  const uuids = datasource.multiSelectReplace(asset).filter(isUUID)
  return uuids.length > 0 ? datasource.getAssets({ UUIDs: uuids }) : []
}

// Fetches the child options of an asset node for lazy loading: child assets
// and, when requested, the asset properties of the parent as leaf options.
export async function fetchLazyChildOptions(
  datasource: DataSource,
  parentUUID: string,
  includeProperties: boolean
): Promise<CascaderOption[]> {
  const [children, properties] = await Promise.all([
    datasource.getAssets({
      ParentUUIDs: [parentUUID],
      IncludeHasChildren: true,
      ...(includeProperties && { IncludeHasAssetProperties: true }),
    }),
    includeProperties ? datasource.getAssetProperties({ AssetUUIDs: [parentUUID] }) : Promise.resolve([]),
  ])
  const childAssetOptions = buildLazyCascaderOptions(children, [])
  const propertyOptions: CascaderOption[] = properties.map((prop) => ({
    label: `📏 ${prop.Name}`,
    value: prop.UUID,
    isLeaf: true,
  }))
  return childAssetOptions.concat(propertyOptions)
}

export function selectable(store: Array<SelectableValue<string>>, value?: string): SelectableValue<string> {
  if (value === undefined) {
    return {}
  }

  return store.filter((e) => e.value === value)
}

export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter((k) => Number.isNaN(+k)) as K[]
}

export function getAggregations(): Array<SelectableValue<string>> {
  return Object.values(AggregationName).map((aggregation) => {
    return {
      label: aggregation,
      value: aggregation,
    } as SelectableValue<string>
  })
}

export function getAggregationsForDatatypes(datatypes: string[]): Array<SelectableValue<string>> {
  let aggregations = Object.values(AggregationName)

  if (datatypes !== undefined && datatypes.length > 0) {
    const datatype = getMostRestrictiveDatatype(datatypes)
    aggregations = aggregations.filter((aggregation) => isValidAggregationForDatatypes(aggregation, datatype))
  }

  return aggregations.map((aggregation) => {
    return {
      label: aggregation,
      value: aggregation,
    } as SelectableValue<string>
  })
}

function getMostRestrictiveDatatype(datatypes: string[]): string {
  let datatype = datatypes.find((dt) => dt.startsWith('[]'))
  if (datatype !== undefined) {
    return datatype
  }

  datatype = datatypes.find((dt) => dt === 'boolean' || dt === 'string')
  if (datatype !== undefined) {
    return datatype
  }

  return 'number'
}

const validAggregationsForNumber: string[] = Object.values(AggregationName) // all aggregations are valid for numbers
const validAggregationsForString: string[] = ['count', 'first', 'last', 'mode']
const validAggregationsForBoolean: string[] = ['count', 'first', 'last', 'mode', 'min', 'max']
const validAggregationsForArray: string[] = ['count', 'first', 'last']

function isValidAggregationForDatatypes(aggregation: string, datatype: string): boolean {
  if (datatype === 'number') {
    return validAggregationsForNumber.includes(aggregation)
  } else if (datatype === 'string') {
    return validAggregationsForString.includes(aggregation)
  } else if (datatype === 'boolean') {
    return validAggregationsForBoolean.includes(aggregation)
  } else if (datatype.startsWith('[]')) {
    return validAggregationsForArray.includes(aggregation)
  }

  return false
}

export function getFillTypes(): Array<SelectableValue<string>> {
  return Object.values(FillType).map((fillType) => {
    return {
      label: fillType,
      value: fillType,
    } as SelectableValue<string>
  })
}

export function getPeriods(): Array<SelectableValue<string>> {
  return [
    {
      label: '$__interval',
      value: '$__interval',
    },
    {
      label: '1s',
      value: '1s',
    },
    {
      label: '10s',
      value: '10s',
    },
    {
      label: '1m',
      value: '1m',
    },
    {
      label: '5m',
      value: '5m',
    },
    {
      label: '10m',
      value: '10m',
    },
    {
      label: '15m',
      value: '15m',
    },
    {
      label: '1h',
      value: '1h',
    },
  ]
}

export function getChildAssets(
  parent: string | null,
  assets: Asset[],
  assetProperties: AssetProperty[] = []
): CascaderOption[] {
  const result: CascaderOption[] = []

  assets
    .filter((asset) => asset.ParentUUID === parent)
    .forEach((asset) => {
      const children = getChildAssets(asset.UUID, assets, assetProperties)
      const properties = assetProperties
        .filter((assetProperty) => assetProperty.AssetUUID === asset.UUID)
        .map((assetProperty) => {
          return {
            label: `📏 ${assetProperty.Name}`,
            value: assetProperty.UUID,
          } as CascaderOption
        })

      const cascaderOption: CascaderOption = {
        label: `📦 ${asset.Name}`,
        value: asset.UUID,
        items: children.concat(properties),
      }
      result.push(cascaderOption)
    })

  return result.sort(sortByLabel)
}

export function buildLazyCascaderOptions(assets: Asset[], assetProperties: AssetProperty[] = []): CascaderOption[] {
  const result: CascaderOption[] = assets.map((asset) => {
    const properties: CascaderOption[] = assetProperties
      .filter((prop) => prop.AssetUUID === asset.UUID)
      .map((prop) => ({
        label: `📏 ${prop.Name}`,
        value: prop.UUID,
        isLeaf: true,
      }))

    // historian >= v8.2.0 returns HasChildren / HasAssetProperties when the
    // matching Include* flag is requested. When present, mark assets without
    // children or properties as leaves so they don't show a dead expand arrow.
    // When absent (older historian), keep the optimistic expandable default.
    const hasFlags = asset.HasChildren !== undefined || asset.HasAssetProperties !== undefined
    const isLeaf = hasFlags && !asset.HasChildren && !asset.HasAssetProperties && properties.length === 0

    return {
      label: `📦 ${asset.Name}`,
      value: asset.UUID,
      items: properties.length > 0 ? properties : undefined,
      isLeaf,
    }
  })

  return result.sort(sortByLabel)
}

export function updateTreeChildren(
  options: CascaderOption[],
  parentUUID: string,
  children: CascaderOption[]
): CascaderOption[] {
  let changed = false
  const result = options.map((option) => {
    if (option.value === parentUUID) {
      changed = true
      if (children.length === 0) {
        return { ...option, items: undefined, isLeaf: true }
      }
      return { ...option, items: children }
    }
    if (option.items && option.items.length > 0) {
      const updatedItems = updateTreeChildren(option.items, parentUUID, children)
      if (updatedItems !== option.items) {
        changed = true
        return { ...option, items: updatedItems }
      }
    }
    return option
  })
  // Preserve structural sharing: only clone the path to the updated node.
  return changed ? result : options
}

export function findOption(
  options: Array<SelectableValue<string[]>>,
  label: string
): SelectableValue<string[]> | undefined {
  for (const option of options) {
    if (option.label === label) {
      return option
    }

    if (option.items && option.items.length > 0) {
      const res = findOption(option.items, label)
      if (res) {
        return res
      }
    }
  }

  return undefined
}

export function tagsToQueryTags(tags: Attributes | undefined): QueryTag[] {
  if (!tags) {
    return []
  }

  let queryTags: QueryTag[] = []

  Object.entries(tags).forEach(([key, value]) => {
    const queryTag: QueryTag = {
      key: key,
      value: value,
      condition: 'AND',
      operator: '=',
    }
    queryTags = [...queryTags, queryTag]
  })

  return queryTags
}

export function valueFiltersToQueryTags(valueFilters: ValueFilter[]): QueryTag[] {
  let queryTags: QueryTag[] = []

  valueFilters.forEach((f) => {
    queryTags.push({
      key: 'value',
      value: f.Value.toString(),
      condition: f.Condition,
      operator: f.Operator,
    })
  })

  return queryTags
}

export function propertyFilterToQueryTags(filter: EventPropertyFilter[]): QueryTag[] {
  let queryTags: QueryTag[] = []

  filter.forEach((f) => {
    queryTags.push({
      key: f.Property,
      value: f.Value?.toString() || '',
      condition: f.Condition,
      operator: f.Operator,
    })
  })

  return queryTags
}

// Returns the UUIDs of the event types that are the parent of one of the
// selected event types. Selectors must already be resolved to UUIDs: template
// variables never match an event type UUID.
export function parentEventTypeUUIDs(selectedEventTypeUUIDs: string[], eventTypes: EventType[]): string[] {
  const selectedEventTypes = eventTypes.filter((e) => selectedEventTypeUUIDs.includes(e.UUID))

  return eventTypes.filter((e) => selectedEventTypes.some((et) => e.UUID === et.ParentUUID)).map((e) => e.UUID)
}

// Resolves the datatype of a property from the properties of the given event
// types. An unresolved property falls back to string: it is the datatype the
// backend assumes for an empty one, and it is the only cast historian cannot
// fail on. A number fallback makes historian cast the filter value to real,
// which errors out the whole query for any non-numeric value.
export function resolvePropertyDatatype(
  property: string,
  eventTypeProperties: EventTypeProperty[],
  eventTypeUUIDs: string[]
): PropertyDatatype {
  return (
    eventTypeProperties.filter((e) => eventTypeUUIDs.includes(e.EventTypeUUID)).find((e) => e.Name === property)
      ?.Datatype ?? PropertyDatatype.String
  )
}

// Returns the event type UUIDs whose properties the property pickers may offer.
// A template variable that resolves to no known event type says nothing about
// the selection (variable not loaded yet, an all-value that is a regex, a
// per-row repeat variable this editor has no scoped vars for), so every
// candidate is offered rather than none: filterProperties drops the properties
// that are missing from this list, and dropping the user's selection is worse
// than offering too much. A selection that does resolve is honoured, so the
// pickers stop offering properties of event types that are not selected.
export function eventTypeUUIDsForProperties(
  datasource: DataSource,
  eventTypeSelectors: string[],
  eventTypes: EventType[],
  onlyParentProperties: boolean
): string[] {
  const isKnownEventType = (uuid: string): boolean => eventTypes.some((e) => e.UUID === uuid)
  const unresolvable = eventTypeSelectors.some(
    (et) => datasource.containsTemplate(et) && !datasource.multiSelectReplace(et).some(isKnownEventType)
  )

  if (!unresolvable) {
    const selectedEventTypeUUIDs = eventTypeSelectors.flatMap((e) => datasource.multiSelectReplace(e))
    return onlyParentProperties ? parentEventTypeUUIDs(selectedEventTypeUUIDs, eventTypes) : selectedEventTypeUUIDs
  }

  // Narrow the fallback to the event types that are a parent of something, so a
  // parent picker never offers a property that exists on child types only.
  return onlyParentProperties
    ? [...new Set(eventTypes.map((e) => e.ParentUUID).filter((uuid): uuid is string => !!uuid))]
    : eventTypes.map((e) => e.UUID)
}

export function matchedAssets(selectedAssets: string[], assets: Asset[]): Asset[] {
  if (selectedAssets.length === 0) {
    return []
  }

  const matched: Asset[] = []

  for (const selectedAsset of selectedAssets) {
    let re: RegExp | undefined = undefined
    if (selectedAsset.length >= 2 && selectedAsset.startsWith('/') && selectedAsset.endsWith('/')) {
      try {
        re = new RegExp(`${selectedAsset.substring(1, selectedAsset.length - 1)}`)
      } catch (e) {
        void e
      }
    }

    for (const asset of assets) {
      if (asset.UUID === selectedAsset || re?.test(asset.AssetPath || asset.Name)) {
        matched.push(asset)
      }
    }
  }

  return matched
}

interface Named {
  Name: string
}

export const sortByName = (a: Named, b: Named): number => {
  const idA = a.Name.toUpperCase()
  const idB = b.Name.toUpperCase()
  return idA.localeCompare(idB)
}

export function sortByLabel(a: CascaderOption | SelectableValue, b: CascaderOption | SelectableValue): number {
  if (!a.label || !b.label) {
    return 0
  }

  const idA = a.label.toUpperCase()
  const idB = b.label.toUpperCase()
  return idA.localeCompare(idB)
}

export function measurementToSelectableValue(measurement: Measurement): SelectableValue<string> {
  return {
    label: measurement.Name,
    value: measurement.UUID,
    description: `(${measurement.Database?.Name ?? '-'}) (${measurement.Datatype}) ${measurement.Description}`,
  }
}

export function defaultQueryOptions(appIsAlertingType: boolean): MeasurementQueryOptions {
  return {
    GroupBy: ['status'],
    Aggregation: {
      Name: AggregationName.Mean,
      Period: '$__interval',
    },
    Tags: { status: 'Good' },
    IncludeLastKnownPoint: false,
    FillInitialEmptyValues: false,
    UseEngineeringSpecs: !appIsAlertingType,
    DisplayDatabaseName: false,
    DisplayDescription: false,
    TruncateInterval: true,
    MetadataAsLabels: true,
    ValueFilters: [],
    Datatypes: [],
  }
}

export const useDebounce = <T>(
  initialValue: T,
  delay: number,
  updateFunc: (value: T) => void
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [actualValue, setActualValue] = useState<T>(initialValue)
  useEffect(() => {
    const debounceId = setTimeout(() => updateFunc(actualValue), delay)
    return () => clearTimeout(debounceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualValue, delay])
  return [actualValue, setActualValue]
}

/**
 * Creates a debounced version of a function that returns a promise.
 * The debounced function delays invoking the original function until after `wait` milliseconds have elapsed
 * since the last time the debounced function was called. If the debounced function is called again before
 * the timeout, the previous timeout is cleared and a new one is set.
 *
 * All calls made during the debounce period will receive the same resolved value from the original function.
 *
 * @typeParam T - The type of the function to debounce. Must return a Promise.
 * @param func - The asynchronous function to debounce.
 * @param wait - The number of milliseconds to delay.
 * @returns A debounced version of the input function that returns a promise resolving to the result of the original function.
 */
export const debouncePromise = <T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>) => {
  let timeout: ReturnType<typeof setTimeout>
  let resolveList: Array<{
    resolve: (value: Awaited<ReturnType<T>>) => void
    reject: (reason?: any) => void
  }> = []

  return (...args: Parameters<T>) =>
    new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      resolveList.push({ resolve, reject })
      timeout = setTimeout(() => {
        func(...args)
          .then((result) => {
            resolveList.forEach(({ resolve }) => resolve(result))
            resolveList = []
          })
          .catch((error) => {
            resolveList.forEach(({ reject }) => reject(error))
            resolveList = []
          })
      }, wait)
    })
}

export function migrateMeasurementQuery(query: MeasurementQuery): MeasurementQuery {
  const measurementQuery = {
    ...query,
  }
  if (!query.IsRegex && query.Measurements?.find((e) => e.length >= 2 && e.startsWith('/') && e.endsWith('/'))) {
    measurementQuery.IsRegex = true
    measurementQuery.Regex = query.Measurements?.find((e) => e.length >= 2 && e.startsWith('/') && e.endsWith('/'))
    measurementQuery.Regex = measurementQuery.Regex?.substring(1, measurementQuery.Regex.length - 1)
    measurementQuery.Measurements = []
  }

  return measurementQuery
}
