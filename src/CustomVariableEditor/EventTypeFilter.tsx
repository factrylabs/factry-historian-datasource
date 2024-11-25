import React from 'react'

import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { EventTypeFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'

export function EventTypeFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypeFilter, valid: boolean) => void
  initialValue?: EventTypeFilter
}) {
  const onKeywordChange = (value: string, valid: boolean) => {
    props.onChange(
      {
        ...props.initialValue,
        Keyword: value,
      },
      valid
    )
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Filter event type'}
          aria-label={'Filter event type'}
          labelWidth={20}
          tooltip={<div>Searches database by name, to use a regex surround pattern with /</div>}
        >
          <MaybeRegexInput onChange={onKeywordChange} initialValue={props.initialValue?.Keyword} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
