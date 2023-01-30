import React from 'react'

import { AddButton } from './AddButton'
import { Tag } from './Tag'
import { KnownCondition, KnownOperator } from './types'
import { getCondition, getOperator, toSelectableValue } from './util'

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
  onChange: (tags: QueryTag[]) => void
  getTagKeyOptions?: () => Promise<string[]>
  getTagValueOptions?: (key: string) => Promise<string[]>
}

const defaultOptions = () => Promise.resolve([])

export const TagsSection = ({ tags, operators, conditions, onChange, getTagKeyOptions = defaultOptions, getTagValueOptions = defaultOptions }: Props): JSX.Element => {
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

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions().then((tags) => {
      return tags.map(toSelectableValue)
    })
  }

  const addNewTag = (tagKey: string, isFirst: boolean) => {
    const minimalTag: QueryTag = {
      key: tagKey,
      value: 'select tag value',
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
          getTagKeyOptions={getTagKeyOptions}
          getTagValueOptions={getTagValueOptions}
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
