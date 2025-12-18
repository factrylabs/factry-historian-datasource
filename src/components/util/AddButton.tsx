import React from 'react'
import { SelectableValue } from '@grafana/data'

import { Seg } from './Seg'

function unwrap<T>(value: T | null | undefined): T {
  if (value == null) {
    throw new Error('value must not be nullish')
  }
  return value
}

type Props = {
  loadOptions: () => Promise<SelectableValue[]>
  allowCustomValue?: boolean
  onAdd: (v: string) => void
}

export const AddButton = ({ loadOptions, allowCustomValue, onAdd }: Props): JSX.Element => {
  return (
    <Seg
      value="+"
      loadOptions={loadOptions}
      allowCustomValue={allowCustomValue}
      onChange={(v) => {
        onAdd(unwrap(v.value))
      }}
    />
  )
}
