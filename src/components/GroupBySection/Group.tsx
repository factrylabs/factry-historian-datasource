import React from 'react'

import { Seg } from 'components/util/Seg'
import { SelectableValue } from '@grafana/data'

type GroupProps = {
  group: string
  loadOptions: () => Promise<SelectableValue[]>
  onRemove: () => void
  onChange: (group: string) => void
}

export const Group = ({ group, loadOptions, onRemove, onChange }: GroupProps): JSX.Element => {
  const defaultOptions = async () => {
    const options = await loadOptions()
    return [{ label: '-- remove group by --', value: undefined } as SelectableValue<string>].concat(options)
  }

  return (
    <Seg
      allowCustomValue
      value={group}
      loadOptions={() => defaultOptions()}
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
