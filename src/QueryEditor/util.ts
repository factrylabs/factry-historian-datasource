import { SelectableValue } from "@grafana/data"
import { getTemplateSrv } from "@grafana/runtime"
import { CascaderOption } from "components/Cascader/Cascader"
import { QueryTag } from "components/TagsSection/TagsSection"
import { AggregationName, Asset, Attributes, EventPropertyFilter } from "types"

export function selectable(store: Array<SelectableValue<string>>, value?: string): SelectableValue<string> {
  if (value === undefined) {
    return {}
  }

  return store.filter((e) => e.value === value)
}

export function enumKeys<O extends object, K extends keyof O = keyof O>(obj: O): K[] {
  return Object.keys(obj).filter(k => Number.isNaN(+k)) as K[];
}

export function getAggregations(): Array<SelectableValue<string>> {
  return enumKeys(AggregationName)
    .map((aggregation) => {
      return {
        label: aggregation,
        value: aggregation,
      } as SelectableValue<string>
    })
}

export function getPeriods(): Array<SelectableValue<string>> {
  return [
    {
      label: "$__interval", value: "$__interval"
    },
    {
      label: "1s", value: "1s"
    },
    {
      label: "10s", value: "10s"
    },
    {
      label: "1m", value: "1m"
    },
    {
      label: "5m", value: "5m"
    },
    {
      label: "10m", value: "10m"
    },
    {
      label: "15m", value: "15m"
    },
    {
      label: "1h", value: "1h"
    }
  ]
}

export function getChildAssets(parent: string | null, assets: Asset[]): CascaderOption[] {
  const result: CascaderOption[] = []

  assets.filter((asset) => asset.ParentUUID === parent).forEach((asset) => {
    let items = getChildAssets(asset.UUID, assets)
    const cascaderOption: CascaderOption = {
      label: asset.Name,
      value: asset.UUID,
      items: items
    }
    result.push(cascaderOption)
  })

  return result
}

export function findOption(options: Array<SelectableValue<string[]>>, label: string): SelectableValue<string[]> | undefined {
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
      condition: "AND",
      operator: "="
    }
    queryTags = [...queryTags, queryTag]
  })

  return queryTags
}

export function propertyFilterToQueryTags(filter: EventPropertyFilter[]): QueryTag[] {
  let queryTags: QueryTag[] = []

  filter.forEach(f => {
    queryTags.push({
      key: f.Property,
      value: f.Value?.toString() || '',
      condition: f.Condition,
      operator: f.Operator
    })
  })

  return queryTags
}

export function matchedAssets(regex: string | undefined, assets: Asset[]): Asset[] {
  if (!regex) {
    return []
  }

  let re: RegExp | undefined = undefined
  try {
    re = new RegExp(`^${regex}$`)
  } catch(e) {
    void e
  }

  const matched: Asset[] = []
  for (const asset of assets) {
    const assetPath = getAssetPath(asset, assets)
    if (asset.UUID === regex || re?.test(assetPath)) {
      matched.push(asset)
    }
  }

  return matched
}

export function getAssetPath(asset: Asset, assets: Asset[]): string {
  if (!asset.ParentUUID) {
    return asset.Name
  }

  const parent = assets.find(
    (item) => item.UUID === asset.ParentUUID
  )
  if (parent) {
    return `${getAssetPath(parent, assets)}\\\\${asset.Name}`
  }

  return asset.Name
}

export function replaceAsset(value: string | undefined, assets: Asset[]): string | undefined {
  const template = getTemplateSrv()
  if (template.containsTemplate(value)) {
    const replacedValue = template.replace(value)
    const asset = assets.find(e => getAssetPath(e, assets) === replacedValue || e.UUID === replacedValue)
    if (asset) {
      return asset.UUID
    }
  }

  return value
}
