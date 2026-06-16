import { BaseOptionType as RCCascaderOption } from 'rc-cascader/lib/Cascader'

import { CascaderOption } from './Cascader'

type onChangeType = ((values: string[], options: CascaderOption[]) => void) | undefined

export const onChangeCascader = (onChanged: onChangeType) => (values: Array<string | number | null>, options: RCCascaderOption[]) => {
  if (onChanged) {
    // map values to strings for backwards compatibility with Cascader components
    onChanged(
      values.map((value) => String(value)),
      fromRCOptions(options)
    )
  }
}

type onLoadDataType = ((options: CascaderOption[]) => void) | undefined

export const onLoadDataCascader = (onLoadData: onLoadDataType) => (options: RCCascaderOption[]) => {
  if (onLoadData) {
    onLoadData(fromRCOptions(options))
  }
}

const fromRCOptions = (options: RCCascaderOption[]): CascaderOption[] => {
  return options.map(fromRCOption)
}

const fromRCOption = (option: RCCascaderOption): CascaderOption => {
  const opt = option as RCCascaderOption & Record<string, any>
  const mapped: CascaderOption = {
    value: option.value ?? '',
    label: (option.label as string) ?? '',
    ...(opt.isLeaf !== undefined && { isLeaf: opt.isLeaf as boolean }),
  }
  // Preserve already-loaded children so lazy-load handlers can detect a node
  // whose children are present and skip refetching on re-expand (rc-cascader
  // calls loadData on every expand of a non-leaf node). Mapped one level deep on
  // purpose: handlers only need items.length, and deep-mapping the whole loaded
  // subtree on every onChange/expand would be wasteful.
  if (Array.isArray(opt.items)) {
    mapped.items = opt.items.map((child: Record<string, any>) => ({
      value: child.value ?? '',
      label: (child.label as string) ?? '',
      ...(child.isLeaf !== undefined && { isLeaf: child.isLeaf as boolean }),
    }))
  }
  return mapped
}
