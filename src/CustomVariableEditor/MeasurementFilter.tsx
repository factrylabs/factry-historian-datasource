import React, { ChangeEvent, FormEvent, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Input } from '@grafana/ui'
import { DataSource } from 'datasource'
import { MeasurementFilter, TimeseriesDatabaseFilter } from 'types'

export function MeasurementFilterRow(props: {
  datasource: DataSource
  onChange: (val: MeasurementFilter) => void
  initialValue?: MeasurementFilter
  templateVariables: SelectableValue<string>
}) {
  const [database, setDatabase] = useState<SelectableValue<string>>()
  let initialLoadDone = false

  const onKeywordChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Keyword: (event as ChangeEvent<HTMLInputElement>).target.value,
    })
  }

  const loadDatabaseOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: TimeseriesDatabaseFilter = {
      Keyword: query,
    }
    const databases = await props.datasource.getTimeseriesDatabases(filter)
    const selectableValues = databases
      .map((e) => {
        return {
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!initialLoadDone) {
      setDatabase(selectableValues.find((e) => e.value === props.initialValue?.DatabaseUUID))
      initialLoadDone = true
    }
    return selectableValues
  }

  const onDatabaseChange = (value: SelectableValue<string>) => {
    props.onChange({
      ...props.initialValue,
      DatabaseUUID: value.value,
    })
    setDatabase(value)
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
          <AsyncSelect
            placeholder="Select database"
            width={25}
            onChange={(value) => onDatabaseChange(value)}
            defaultOptions
            loadOptions={loadDatabaseOptions}
            value={database}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
