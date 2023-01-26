import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import { QueryOptions } from './QueryOptions'
import type { MeasurementQuery, MeasurementQueryState, QueryEditorState, TimeseriesDatabase } from 'types'

export interface Props {
  state: QueryEditorState
  saveState(state: QueryEditorState): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onLoadMeasurementOptions: (query: string) => Promise<Array<SelectableValue<string>>>
}

export const Measurements = ({
  state, saveState,
  onChangeMeasurementQuery,
  onLoadMeasurementOptions
}: Props): JSX.Element => {
  const selectedMeasurement = (): SelectableValue<string> => {
    const measurementQuery = state.measurementsState.queryOptions.measurementQuery
    if (measurementQuery.Measurements === undefined) {
      return {}
    }

    if (measurementQuery.Measurements.length === 0) {
      return {}
    }

    const measurementUUID = measurementQuery.Measurements[0]
    const measurement = state.measurements.find(m => m.UUID === measurementUUID)
    if (!measurement) {
      return {}
    }
    const database = state.databases.find(e => e.UUID === measurement.DatabaseUUID)
    return { label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` }
  }

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
      const updatedQuery = { ...state.measurementsState.queryOptions.measurementQuery, Measurements: measurements }
      saveState({
        ...state,
        measurementsState: {
          ...state.measurementsState,
          queryOptions: {
            ...state.measurementsState.queryOptions,
            measurementQuery: updatedQuery
          },
          selectedMeasurement: event.label
        }
      })
      onChangeMeasurementQuery(updatedQuery)
    }
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        queryOptions: {
          ...state.measurementsState.queryOptions,
          filter: { ...state.measurementsState.queryOptions.filter, Database: event.value }
        }
      }
    })
  }

  const defaultMeasurementOptions = (): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = []
    state.measurements.forEach((measurement) => {
      const database = state.databases.find(e => e.UUID === measurement.DatabaseUUID)
      result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
    })
    return result
  }

  const handleChangeMeasurementQuery = (options: MeasurementQueryState): void => {
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        queryOptions: options
      }
    })
    onChangeMeasurementQuery(options.measurementQuery)
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(state.databases), state.measurementsState.queryOptions.filter.Database)}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with">
          <AsyncSelect
            value={selectedMeasurement()}
            placeholder="select measurement"
            loadOptions={onLoadMeasurementOptions}
            defaultOptions={defaultMeasurementOptions()}
            onChange={onMeasurementChange}
            menuShouldPortal
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={state.measurementsState.queryOptions}
        onChange={handleChangeMeasurementQuery}
      />
    </div>
  )
}
