import React from 'react'

import { Seg } from 'components/util/Seg'
import { SelectableValue } from '@grafana/data'

type GroupProps = {
  group: string
  options: Array<SelectableValue<string>>
  onRemove: () => void
  onChange: (group: string) => void
}

const defaultOptions = (options: Array<SelectableValue<string>>) =>
  Promise.resolve([{ label: '-- remove filter --', value: undefined } as SelectableValue<string>].concat(options))

export const Group = ({ group, options, onRemove, onChange }: GroupProps): JSX.Element => {
  return (
    <Seg
      allowCustomValue
      value={group}
      loadOptions={() => defaultOptions(options)}
      onChange={(v) => {
        const { value } = v
        if (value === undefined) {
          onRemove()
        } else {
          onChange(value ?? '')
        }
      }}
    />
  )
}
