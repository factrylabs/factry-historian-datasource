import React from 'react'
import { InlineField } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { AddButton } from 'components/util/AddButton'
import { Group } from './Group'
import { toSelectableValue } from 'components/TagsSection/util'

type Props = {
  groups: string[]
  onChange: (groups: string[]) => void
  getTagKeyOptions?: () => Promise<string[]>
}

const defaultKeys = () => Promise.resolve(['status'])

export const GroupBySection = ({ groups, onChange, getTagKeyOptions = defaultKeys }: Props): JSX.Element => {
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

  const getGroupByOptions = async () => {
    const tags = await getTagKeyOptions()
    return tags.map(toSelectableValue).concat(templateVariables)
  }

  return (
    <>
      {groups.map((t, i) => {
        return (
          <InlineField key={i}>
            <Group
              group={t}
              loadOptions={getGroupByOptions}
              onChange={(newGroup) => onGroupChange(newGroup || '', i)}
              onRemove={() => onGroupRemove(i)}
            />
          </InlineField>
        )
      })}
      <InlineField>
        <AddButton
          allowCustomValue
          loadOptions={getGroupByOptions}
          onAdd={(v) => {
            addNewGroup(v)
          }}
        />
      </InlineField>
    </>
  )
}
