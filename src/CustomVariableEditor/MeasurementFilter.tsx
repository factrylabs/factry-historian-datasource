import React, { useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { fieldWidth, labelWidth, MeasurementDatatype, MeasurementFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { useDebounce } from 'QueryEditor/util'

export interface MeasurementFilterProps {
  datasource: DataSource
  onChange: (val: MeasurementFilter, filterValid: boolean) => void
  initialValue?: MeasurementFilter
  templateVariables: Array<SelectableValue<string>>
}

const datatypeOptions: Array<SelectableValue<string>> = Object.entries(MeasurementDatatype).map(([_, value]) => {
  return { label: value, value: value }
})

export function MeasurementFilterRow (props: MeasurementFilterProps) {
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

  const onDatatypesChange = (values: Array<SelectableValue<string>>) => {
    if (!values || values.length === 0) {
      props.onChange(
        {
          ...props.initialValue,
          Datatypes: [],
        },
        true
      )
    } else {
      props.onChange(
        {
          ...props.initialValue,
          Datatypes: values.map((e) => e.value ?? ''),
        },
        true
      )
    }
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Filter measurement'}
          aria-label={'Filter measurement'}
          labelWidth={labelWidth}
          tooltip={<div>Searches measurement by name, to use a regex surround pattern with /</div>}
        >
          <MaybeRegexInput
            onChange={(value, ok) => onKeywordChange(value, ok)}
            initialValue={keyword}
            width={fieldWidth}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={'Filter by database'}
          aria-label={'Filter by database'}
          labelWidth={labelWidth}
          tooltip={<div>Filters measurements by database</div>}
        >
          <DatabaseSelect
            datasource={props.datasource}
            onChange={onDatabaseChange}
            templateVariables={props.templateVariables}
            initialValue={props.initialValue?.DatabaseUUIDs}
            selectedDatabases={selectedDatabases}
            setSelectedDatabases={setSelectedDatabases}
            width={fieldWidth}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Filter datatypes"
          labelWidth={labelWidth}
          aria-label="Filter datatypes"
          tooltip={<div>Filters measurements by their datatype</div>}
        >
          <MultiSelect
            value={props.initialValue?.Datatypes ?? []}
            placeholder="All datatypes"
            options={datatypeOptions}
            onChange={onDatatypesChange}
            isClearable
            width={fieldWidth}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
