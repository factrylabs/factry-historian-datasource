import React, { ChangeEvent, FormEvent } from 'react'

import { InlineField, InlineFieldRow, Input } from '@grafana/ui'
import { DataSource } from 'datasource'
import { EventTypeFilter } from 'types'

export function EventTypeFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypeFilter) => void
  initialValue?: EventTypeFilter
}) {
  const onKeywordChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Keyword: (event as ChangeEvent<HTMLInputElement>).target.value,
    })
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
          <Input value={props.initialValue?.Keyword} onChange={onKeywordChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
