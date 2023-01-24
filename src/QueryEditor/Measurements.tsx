import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import { QueryOptions } from './QueryOptions'
import type { Attributes, Measurement, MeasurementFilter, MeasurementQuery, TimeseriesDatabase } from 'types'

export interface Props {
  databases: TimeseriesDatabase[]
  measurements: Measurement[]
  filter: MeasurementFilter
  measurementQuery: MeasurementQuery
  tags: any
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onRunQuery: () => void
  onTimeseriesDatabaseChange: (database: SelectableValue<string>) => void
  onLoadMeasurementOptions: (query: string) => Promise<Array<SelectableValue<string>>>
  onUpdateTags(updatedTags: Attributes): void
}

export const Measurements = ({
  databases, measurements, filter, measurementQuery, tags,
  onRunQuery, onChangeMeasurementQuery,
  onTimeseriesDatabaseChange,
  onLoadMeasurementOptions,
  onUpdateTags
}: Props): JSX.Element => {
  const selectedMeasurement = (): SelectableValue<string> => {
    if (measurementQuery.Measurements === undefined) {
      return {}
    }

    if (measurementQuery.Measurements.length === 0) {
      return {}
    }

    const measurementUUID = measurementQuery.Measurements[0]
    const measurement = measurements.find(m => m.UUID === measurementUUID)
    if (!measurement) {
      return {}
    }

    const database = databases.find(e => e.UUID === measurement.DatabaseUUID)
    return { label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` }
  }

  const [measurement, setMeasurement] = useState<SelectableValue<string>>(selectedMeasurement());

  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return result
  }

  const onMeasurementChange = (event: SelectableValue<string>): void => {
    setMeasurement(event)
    if (event.value) {
      const measurements = [event.value]
      const updatedQuery = { ...measurementQuery, Measurements: measurements }
      onChangeMeasurementQuery(updatedQuery)
      onRunQuery()
    }
  }

  const defaultMeasurementOptions = (): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = []
    measurements.forEach((measurement) => {
      const database = databases.find(e => e.UUID === measurement.DatabaseUUID)
      result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
    })
    return result
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
            value={measurement}
            placeholder="select measurement"
            loadOptions={onLoadMeasurementOptions}
            defaultOptions={defaultMeasurementOptions()}
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
