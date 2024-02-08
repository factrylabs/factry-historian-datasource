import React, { ChangeEvent, FormEvent } from 'react'

import { InlineField, InlineFieldRow, Input } from '@grafana/ui'
import { DataSource } from 'datasource'
import { TimeseriesDatabaseFilter } from 'types'

export function DatabaseFilterRow(props: {
  datasource: DataSource
  onChange: (val: TimeseriesDatabaseFilter) => void
  initialValue?: TimeseriesDatabaseFilter
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
          label={'Keyword'}
          aria-label={'Keyword'}
          labelWidth={20}
          tooltip={<div>Searches database by name, to use a regex surround pattern with /</div>}
        >
          <Input value={props.initialValue?.Keyword} onChange={onKeywordChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
