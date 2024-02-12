import React, { ChangeEvent, FormEvent, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Input } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { MeasurementFilter } from 'types'

export interface MeasurementFilterProps {
  datasource: DataSource
  onChange: (val: MeasurementFilter) => void
  initialValue?: MeasurementFilter
  templateVariables: Array<SelectableValue<string>>
}

export function MeasurementFilterRow(props: MeasurementFilterProps) {
  const [selectedDatabases, setSelectedDatabases] = useState<Array<SelectableValue<string>>>()

  const onKeywordChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Keyword: (event as ChangeEvent<HTMLInputElement>).target.value,
    })
  }

  const onDatabaseChange = (values: string[]) => {
    props.onChange({
      ...props.initialValue,
      DatabaseUUIDs: values,
    })
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Keyword'}
          aria-label={'Keyword'}
          labelWidth={20}
          tooltip={<div>Searches measurement by name</div>}
        >
          <Input value={props.initialValue?.Keyword} onChange={(e) => onKeywordChange(e)} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={'Database'}
          aria-label={'Database'}
          labelWidth={20}
          tooltip={<div>Searches measurement by database</div>}
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
