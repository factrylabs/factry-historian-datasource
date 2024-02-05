import { SelectableValue } from '@grafana/data'
import { QueryTag } from './types'

export function toSelectableValue<T extends string>(t: T): SelectableValue<T> {
  return { label: t, value: t }
}

export function getOperator(tag: QueryTag): string {
  return tag.operator ?? (isRegex(tag.value) ? '=~' : '=')
}

export function getCondition(tag: QueryTag, isFirst: boolean): string | undefined {
  return isFirst ? undefined : tag.condition ?? 'AND'
}

export function isRegex(text: string): boolean {
  return /^\/.*\/$/.test(text)
}
