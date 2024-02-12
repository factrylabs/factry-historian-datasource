import React, { useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect } from '@grafana/ui'
import { DataSource } from 'datasource'
import { TimeseriesDatabaseFilter } from 'types'

export interface DatabaseSelectProps {
  datasource: DataSource
  onChange: (val: string[]) => void
  initialValue?: string[]
  templateVariables: Array<SelectableValue<string>>
}

export function DatabaseSelect(props: DatabaseSelectProps) {
  const [databases, setDatabases] = useState<Array<SelectableValue<string>>>()
  let initialLoadDone = false

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
      setDatabases(selectableValues.filter((e) => props.initialValue?.includes(e.value ?? '')))
      initialLoadDone = true
    }
    return selectableValues
  }

  const onDatabaseChange = (values: Array<SelectableValue<string>>) => {
    props.onChange(values.map((e) => e.value ?? ''))
    setDatabases(values)
  }

  return (
    <AsyncMultiSelect
      placeholder="Select database(s)"
      onChange={(value) => onDatabaseChange(value)}
      defaultOptions
      loadOptions={loadDatabaseOptions}
      value={databases}
    />
  )
}
