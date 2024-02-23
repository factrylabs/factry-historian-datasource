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
  MeasurementQueryOptions,
} from 'types'

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

function isValidAggregationForDatatypes(aggregation: string, datatype: string): boolean {
  const validAggregationsForNumber: string[] = Object.values(AggregationName) // all aggregations are valid for numbers
  const validAggregationsForNotNumber: string[] = ['count', 'first', 'last']

  if (datatype === 'number') {
    return validAggregationsForNumber.includes(aggregation)
  } else if (datatype.startsWith('[]')) {
    return false // no aggregations are valid for arrays
  } else {
    return validAggregationsForNotNumber.includes(aggregation)
  }
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
        re = new RegExp(`^${selectedAsset.substring(1, selectedAsset.length - 1)}$`)
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

export function sortByLabel(a: CascaderOption, b: CascaderOption): number {
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
