import { SelectableValue } from "@grafana/data"
import { AggregationName } from "types"

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

export function getIntervals(): Array<SelectableValue<string>> {
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
