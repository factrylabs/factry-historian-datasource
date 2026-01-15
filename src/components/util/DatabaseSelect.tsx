import React from 'react'

import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect } from '@grafana/ui'
import { DataSource } from 'datasource'
import { TimeseriesDatabaseFilter } from 'types'
import { debouncePromise } from 'QueryEditor/util'

export interface DatabaseSelectProps {
  datasource: DataSource
  onChange: (val: string[]) => void
  initialValue?: string[]
  selectedDatabases: Array<SelectableValue<string>> | undefined
  setSelectedDatabases: React.Dispatch<React.SetStateAction<Array<SelectableValue<string>> | undefined>>
  templateVariables: Array<SelectableValue<string>>
  width?: number
}

export function DatabaseSelect(props: DatabaseSelectProps) {
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
      // Only show databases that exist in current datasource (filters out UUIDs from other datasources)
      props.setSelectedDatabases(selectableValues.filter((e) => props.initialValue?.includes(e.value ?? '')))
      initialLoadDone = true
    }
    return selectableValues
  }

  const onDatabaseChange = (values: Array<SelectableValue<string>>) => {
    props.onChange(values.map((e) => e.value ?? ''))
    props.setSelectedDatabases(values)
  }

  return (
    <AsyncMultiSelect
      placeholder="All databases"
      onChange={(value) => onDatabaseChange(value)}
      defaultOptions
      loadOptions={debouncePromise(loadDatabaseOptions, 300)}
      value={props.selectedDatabases}
      width={props.width}
    />
  )
}
