import React from 'react'

import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { TimeseriesDatabaseFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'

export function DatabaseFilterRow(props: {
  datasource: DataSource
  onChange: (val: TimeseriesDatabaseFilter, valid: boolean) => void
  initialValue?: TimeseriesDatabaseFilter
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
          label={'Filter database'}
          aria-label={'Filter database'}
          labelWidth={20}
          tooltip={<div>Searches database by name, to use a regex surround pattern with /</div>}
        >
          <MaybeRegexInput onChange={onKeywordChange} initialValue={props.initialValue?.Keyword} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
