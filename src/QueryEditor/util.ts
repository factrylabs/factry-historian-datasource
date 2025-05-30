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
  FillType,
  Measurement,
  MeasurementQuery,
  MeasurementQueryOptions,
  PropertyType,
  ValueFilter,
} from 'types'
import { isFeatureEnabled } from 'util/semver'

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

export function getAggregationsForVersionAndDatatypes(
  datatypes: string[],
  version: string
): Array<SelectableValue<string>> {
  let selectable = getAggregationsForDatatypes(datatypes)
  if (!isFeatureEnabled(version, '7.3.0', true)) {
    return selectable.filter((aggregation) => aggregation.value !== 'twa')
  }
  return selectable
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

export function migrateMeasurementQuery(query: MeasurementQuery): MeasurementQuery {
  const measurementQuery = {
    ...query,
  }
  if (!query.IsRegex && query.Measurements?.find((e) => e.length >= 2 && e.startsWith('/') && e.endsWith('/'))) {
    query.IsRegex = true
    query.Regex = query.Measurements?.find((e) => e.length >= 2 && e.startsWith('/') && e.endsWith('/'))
    query.Regex = query.Regex?.substring(1, query.Regex.length - 1)
    query.Measurements = []
  }

  return measurementQuery
}

export function isSupportedPropertyType(type: PropertyType, version: string): boolean {
  if (type === PropertyType.PeriodicWithDimension && !isFeatureEnabled(version, '7.2.0', true)) {
    return false
  }
  return true
}
