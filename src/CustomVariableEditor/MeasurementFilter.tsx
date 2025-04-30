import React, { useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { MeasurementFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { useDebounce } from 'QueryEditor/util'

export interface MeasurementFilterProps {
  datasource: DataSource
  onChange: (val: MeasurementFilter, filterValid: boolean) => void
  initialValue?: MeasurementFilter
  templateVariables: Array<SelectableValue<string>>
}

export function MeasurementFilterRow(props: MeasurementFilterProps) {
  const [selectedDatabases, setSelectedDatabases] = useState<Array<SelectableValue<string>>>()
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

  const onKeywordChange = (keyword: string, valid: boolean) => {
    setKeywordValid(valid)
    setKeyword(keyword)
  }

  const onDatabaseChange = (values: string[]) => {
    props.onChange(
      {
        ...props.initialValue,
        DatabaseUUIDs: values,
      },
      true
    )
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Filter measurement'}
          aria-label={'Filter measurement'}
          labelWidth={20}
          tooltip={<div>Searches measurement by name, to use a regex surround pattern with /</div>}
        >
          <MaybeRegexInput
            onChange={(value, ok) => onKeywordChange(value, ok)}
            initialValue={keyword}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={'Filter by database'}
          aria-label={'Filter by database'}
          labelWidth={20}
          tooltip={<div>Filters measurements by database</div>}
        >
          <DatabaseSelect
            datasource={props.datasource}
            onChange={onDatabaseChange}
            templateVariables={props.templateVariables}
            initialValue={props.initialValue?.DatabaseUUIDs}
            selectedDatabases={selectedDatabases}
            setSelectedDatabases={setSelectedDatabases}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
