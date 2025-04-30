import React, { useState } from 'react'

import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { EventTypeFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { useDebounce } from 'QueryEditor/util'

export function EventTypeFilterRow(props: {
  datasource: DataSource
  onChange: (val: EventTypeFilter, valid: boolean) => void
  initialValue?: EventTypeFilter
}) {
  const [keyword, setKeyword] = useDebounce<string>(props.initialValue?.Keyword ?? '', 500, (value) =>
    props.onChange(
      {
        ...props.initialValue,
        Keyword: value,
      },
      keywordValid
    )
  )
  const [keywordValid, setKeywordValid] = useState<boolean>(true)

  const onKeywordChange = (value: string, valid: boolean) => {
    setKeywordValid(valid)
    setKeyword(value)
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
          <MaybeRegexInput onChange={onKeywordChange} initialValue={keyword} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
