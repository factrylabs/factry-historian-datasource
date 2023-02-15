import React from 'react'

import { Seg } from 'components/util/Seg'

type GroupProps = {
  group: string
  onRemove: () => void
  onChange: (group: string) => void
}

const defaultOptions = () => Promise.resolve([{ label: '-- remove filter --', value: undefined }])

export const Group = ({ group, onRemove, onChange }: GroupProps): JSX.Element => {
  return (
    <Seg
      allowCustomValue
      value={group}
      loadOptions={defaultOptions}
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
