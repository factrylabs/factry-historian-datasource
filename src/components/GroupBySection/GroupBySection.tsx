import React from 'react'

import { InlineField } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { AddButton } from 'components/util/AddButton'
import { Group } from './Group'

type Props = {
  groups: string[]
  onChange: (groups: string[]) => void
}

export const GroupBySection = ({ groups, onChange }: Props): JSX.Element => {
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

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
                options={templateVariables}
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
                options={templateVariables}
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
          loadOptions={() => Promise.resolve(templateVariables)}
          onAdd={(v) => {
            addNewGroup(v)
          }}
        />
      </InlineField>
    </>
  )
}
