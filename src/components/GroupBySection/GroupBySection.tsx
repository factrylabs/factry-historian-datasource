import React from 'react'

import { InlineField } from '@grafana/ui'
import { AddButton } from 'components/util/AddButton'
import { Group } from './Group'

type Props = {
  groups: string[]
  onChange: (groups: string[]) => void
}

export const GroupBySection = ({ groups, onChange }: Props): JSX.Element => {
  const onGroupChange = (newGroup: string, index: number) => {
    const newGroups = groups.map((group, i) => {
      return index === i ? newGroup : group
    })
    onChange(newGroups)
  }

  const onGroupRemove = (index: number) => {
    const newGroups = groups.filter((t, i) => i !== index)
    onChange(newGroups)
  }

  const addNewGroup = (group: string) => {
    onChange([...groups, group])
  }

  return (
    <>
      {groups.map((t, i) => {
        if (i === 0) {
          return (
            <InlineField key={i}>
              <Group
                group={t}
                onChange={(newGroup) => onGroupChange(newGroup || '', i)}
                onRemove={() => onGroupRemove(i)}
              />
            </InlineField>
          )
        } else {
          return (
            <InlineField key={i}>
              <Group
                group={t}
                onChange={(newGroup) => onGroupChange(newGroup || '', i)}
                onRemove={() => onGroupRemove(i)}
              />
            </InlineField>
          )
        }
      })}
      <InlineField>
        <AddButton
          allowCustomValue
          loadOptions={() => Promise.resolve([])}
          onAdd={(v) => {
            addNewGroup(v)
          }}
        />
      </InlineField>
    </>
  )
}
