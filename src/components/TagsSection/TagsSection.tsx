import React from 'react'

import { getTemplateSrv } from '@grafana/runtime'
import { AddButton } from 'components/util/AddButton'
import { Tag } from './Tag'
import { getCondition, getOperator, toSelectableValue } from './util'
import { KnownCondition, KnownOperator } from '../../util/eventFilter'

export interface QueryTag {
  key: string
  operator?: string
  condition?: string
  value: string
}

type Props = {
  tags: QueryTag[]
  operators?: KnownOperator[]
  conditions?: KnownCondition[]
  placeholder?: string
  onChange: (tags: QueryTag[]) => void
  getTagKeyOptions?: () => Promise<string[]>
  getTagValueOptions?: (key: string) => Promise<string[]>
}

const defaultKeys = () => Promise.resolve(['status'])

const defaultValues = () => Promise.resolve(['Good'])

export const TagsSection = ({
  tags,
  operators,
  conditions,
  placeholder = '',
  onChange,
  getTagKeyOptions = defaultKeys,
  getTagValueOptions = defaultValues,
}: Props): JSX.Element => {
  const templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  const onTagChange = (newTag: QueryTag, index: number) => {
    const newTags = tags.map((tag, i) => {
      return index === i ? newTag : tag
    })
    onChange(newTags)
  }

  const onTagRemove = (index: number) => {
    const newTags = tags.filter((t, i) => i !== index)
    onChange(newTags)
  }

  const tagKeyOptions = () => {
    return getTagKeyOptions().then((tags) => {
      return tags.concat(templateVariables.map((e) => e.value))
    })
  }

  const tagValueOptions = (key: string) => {
    return getTagValueOptions(key).then((tags) => {
      return tags.concat(templateVariables.map((e) => e.value))
    })
  }

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => {
      return tags.map(toSelectableValue).concat(templateVariables)
    })
  }

  const addNewTag = (tagKey: string, isFirst: boolean) => {
    const minimalTag: QueryTag = {
      key: tagKey,
      value: placeholder,
    }

    const newTag: QueryTag = {
      key: minimalTag.key,
      value: minimalTag.value,
      operator: getOperator(minimalTag),
      condition: getCondition(minimalTag, isFirst),
    }

    onChange([...tags, newTag])
  }

  return (
    <>
      {tags.map((t, i) => (
        <Tag
          tag={t}
          isFirst={i === 0}
          key={i}
          operators={operators}
          conditions={conditions}
          onChange={(newT) => {
            onTagChange(newT, i)
          }}
          onRemove={() => {
            onTagRemove(i)
          }}
          getTagKeyOptions={tagKeyOptions}
          getTagValueOptions={tagValueOptions}
        />
      ))}
      <AddButton
        allowCustomValue
        loadOptions={getTagKeySegmentOptions}
        onAdd={(v) => {
          addNewTag(v, tags.length === 0)
        }}
      />
    </>
  )
}
