import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import { QueryOptions } from './QueryOptions'
import type { Attributes, MeasurementFilter, MeasurementQuery, Query, TimeseriesDatabase } from 'types'

export interface Props {
  databases: TimeseriesDatabase[]
  filter: MeasurementFilter
  query: Query
  measurementQuery: MeasurementQuery
  tags: any
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onRunQuery: () => void
  onTimeseriesDatabaseChange: (database: SelectableValue<string>) => void
  onLoadMeasurementOptions: (query: string) => Promise<Array<SelectableValue<string>>>
  onUpdateTags(updatedTags: Attributes): void
}

export const Measurements = ({
  databases, filter, query, measurementQuery, tags,
  onRunQuery, onChangeMeasurementQuery,
  onTimeseriesDatabaseChange,
  onLoadMeasurementOptions,
  onUpdateTags
}: Props): JSX.Element => {
  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return result
  }

  const onMeasurementChange = (event: SelectableValue<string>): void => {
    if (event.value) {
      const measurements = [event.value]
      const updatedQuery = { ...measurementQuery, Measurements: measurements }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(databases), filter.Database)}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with">
          <AsyncSelect
            placeholder="select measurement"
            loadOptions={onLoadMeasurementOptions}
            defaultOptions
            onChange={onMeasurementChange}
            menuShouldPortal
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        measurementQuery={measurementQuery}
        tags={tags}
        onChangeMeasurementQuery={onChangeMeasurementQuery}
        onUpdateTags={onUpdateTags}
        onRunQuery={onRunQuery}
      />
    </div>
  )
}
