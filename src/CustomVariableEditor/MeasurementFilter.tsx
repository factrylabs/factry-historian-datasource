import React, { useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { MeasurementFilter } from 'types'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'

export interface MeasurementFilterProps {
  datasource: DataSource
  onChange: (val: MeasurementFilter, filterValid: boolean) => void
  initialValue?: MeasurementFilter
  templateVariables: Array<SelectableValue<string>>
}

export function MeasurementFilterRow(props: MeasurementFilterProps) {
  const [selectedDatabases, setSelectedDatabases] = useState<Array<SelectableValue<string>>>()

  const onKeywordChange = (keyword: string, valid: boolean) => {
    props.onChange(
      {
        ...props.initialValue,
        Keyword: keyword,
      },
      valid
    )
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
            initialValue={props.initialValue?.Keyword}
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
