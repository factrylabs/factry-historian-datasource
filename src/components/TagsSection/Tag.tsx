import React from 'react'

import { SelectableValue } from '@grafana/data'
import { Seg } from '../util/Seg'
import { KnownCondition, KnownOperator, QueryTag } from './types'
import { getCondition, getOperator, isRegex, toSelectableValue } from './util'

function adjustOperatorIfNeeded(currentOperator: string, newTagValue: string): string {
  const isCurrentOperatorRegex = currentOperator === '=~' || currentOperator === '!~'
  const isNewTagValueRegex = isRegex(newTagValue)

  if (isNewTagValueRegex) {
    return isCurrentOperatorRegex ? currentOperator : '=~'
  } else {
    return isCurrentOperatorRegex ? '=' : currentOperator
  }
}

const knownOperators: KnownOperator[] = ['=']
const knownConditions: KnownCondition[] = ['AND', 'OR']

const operatorOptions: Array<SelectableValue<KnownOperator>> = knownOperators.map(toSelectableValue)
const conditionOptions: Array<SelectableValue<KnownCondition>> = knownConditions.map(toSelectableValue)

type TagProps = {
  tag: QueryTag
  isFirst: boolean
  operators?: KnownOperator[]
  conditions?: KnownCondition[]
  onRemove: () => void
  onChange: (tag: QueryTag) => void
  getTagKeyOptions?: () => Promise<string[]>
  getTagValueOptions?: (key: string) => Promise<string[]>
}

const defaultOptions = () => Promise.resolve([])

export const Tag = ({
  tag,
  isFirst,
  operators = knownOperators,
  conditions = knownConditions,
  onRemove,
  onChange,
  getTagKeyOptions = defaultOptions,
  getTagValueOptions = defaultOptions,
}: TagProps): JSX.Element => {
  const operator = getOperator(tag)
  const condition = getCondition(tag, isFirst)

  const loadConditionOptions = () => {
    if (conditions) {
      return Promise.resolve(conditions.map(toSelectableValue))
    }

    return Promise.resolve(conditionOptions)
  }

  const loadOperatorOptions = () => {
    if (operators) {
      return Promise.resolve(operators.map(toSelectableValue))
    }

    return Promise.resolve(operatorOptions)
  }

  const getTagKeySegmentOptions = () => {
    return getTagKeyOptions()
      .catch((err) => {
        // in this UI element we add a special item to the list of options,
        // that is used to remove the element.
        // this causes a problem: if `getTagKeyOptions` fails with an error,
        // the remove-filter option is never added to the list,
        // and the UI element can not be removed.
        // to avoid it, we catch any potential errors coming from `getTagKeyOptions`,
        // log the error, and pretend that the list of options is an empty list.
        // this way the remove-item option can always be added to the list.
        console.error(err)
        return []
      })
      .then((tags) => [{ label: '-- remove filter --', value: undefined }, ...tags.map(toSelectableValue)])
  }

  const getTagValueSegmentOptions = () => {
    return getTagValueOptions(tag.key).then((tags) => tags.map(toSelectableValue))
  }

  return (
    <div className="gf-form">
      {condition != null && (
        <Seg
          value={condition}
          loadOptions={loadConditionOptions}
          onChange={(v) => {
            onChange({ ...tag, condition: v.value })
          }}
        />
      )}
      <Seg
        allowCustomValue
        value={tag.key}
        loadOptions={getTagKeySegmentOptions}
        onChange={(v) => {
          const { value } = v
          if (value === undefined) {
            onRemove()
          } else {
            onChange({ ...tag, key: value ?? '' })
          }
        }}
      />
      <Seg
        value={operator}
        loadOptions={loadOperatorOptions}
        onChange={(op) => {
          onChange({ ...tag, operator: op.value })
        }}
      />
      <Seg
        allowCustomValue
        value={tag.value}
        loadOptions={getTagValueSegmentOptions}
        onChange={(v) => {
          const value = v.value ?? ''
          onChange({ ...tag, value, operator: adjustOperatorIfNeeded(operator, value) })
        }}
      />
    </div>
  )
}
