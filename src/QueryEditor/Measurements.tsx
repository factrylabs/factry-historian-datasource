import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { QueryTag } from 'components/TagsSection/types'
import { selectable } from './util'
import { QueryOptions } from './QueryOptions'
import type { MeasurementQuery, MeasurementQueryOptions, QueryEditorState, TimeseriesDatabase } from 'types'

export interface Props {
  state: QueryEditorState
  appIsAlertingType: boolean
  saveState(state: QueryEditorState): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  onLoadMeasurementOptions: (query: string) => Promise<Array<SelectableValue<string>>>
}

export const Measurements = ({
  state, appIsAlertingType, saveState,
  onChangeMeasurementQuery,
  onLoadMeasurementOptions
}: Props): JSX.Element => {
  const selectedMeasurement = (): SelectableValue<string> => {
    const measurementQuery = state.measurementsState.options.query
    if (!measurementQuery.Measurement) {
      return { label: state.measurementsState.selectedMeasurement, value: state.measurementsState.selectedMeasurement }
    }

    const measurementUUID = measurementQuery.Measurement
    const measurement = state.measurements.find(m => m.UUID === measurementUUID)
    if (!measurement) {
      return { label: state.measurementsState.selectedMeasurement, value: state.measurementsState.selectedMeasurement }
    }
    let label: string | undefined = measurement.Name
    let value: string | undefined = measurement.UUID
    if (getTemplateSrv().containsTemplate(state.measurementsState.selectedMeasurement)) {
      label = state.measurementsState.selectedMeasurement
      value = state.measurementsState.selectedMeasurement
    }
    const database = state.databases.find(e => e.UUID === measurement.DatabaseUUID)
    return { label: label, value: value, description: `(${database?.Name}) ${measurement.Description}` }
  }

  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = []
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return [
      ...getTemplateSrv().getVariables().map((e => {
        return { label: `$${e.name}`, value: `$${e.name}` }
      })),
      ...result
    ]
  }

  const loadMeasurementOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const options = await onLoadMeasurementOptions(getTemplateSrv().replace(query))
    return [
      ...getTemplateSrv().getVariables().map((e => {
        return { label: `$${e.name}`, value: `$${e.name}` }
      })),
      ...options
    ]
  }

  const onMeasurementChange = (event: SelectableValue<string>): void => {
    if (event.value) {
      const updatedQuery = { ...state.measurementsState.options.query, Measurement: event.value }
      saveState({
        ...state,
        measurementsState: {
          ...state.measurementsState,
          options: {
            ...state.measurementsState.options,
            query: updatedQuery,
          },
          selectedMeasurement: event.label
        }
      })
      onChangeMeasurementQuery(updatedQuery)
    }
  }

  const handleCustomMeasurement = (value: string): void => {
    if (!getTemplateSrv().containsTemplate(value) && !(value.startsWith('/') && value.endsWith('/'))) {
      return
    }

    const updatedQuery = { ...state.measurementsState.options.query, Measurement: value }
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurement: value
      }
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    let databaseUUID = event.value
    if (getTemplateSrv().containsTemplate(event.value)) {
      databaseUUID = state.databases.find(e => e.Name = getTemplateSrv().replace(event.value))?.UUID
    }
    const updatedQuery = { ...state.measurementsState.options.query, Database: event.value } as MeasurementQuery
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
          filter: { ...state.measurementsState.options.filter, Database: databaseUUID }
        },
      }
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  const defaultMeasurementOptions = (): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = []
    state.measurements.forEach((measurement) => {
      const database = state.databases.find(e => e.UUID === measurement.DatabaseUUID)
      result.push({ label: measurement.Name, value: measurement.UUID, description: `(${database?.Name}) ${measurement.Description}` })
    })
    return [
      ...getTemplateSrv().getVariables().map((e => {
        return { label: `$${e.name}`, value: `$${e.name}` }
      })),
      ...result
    ]
  }

  const handleChangeMeasurementQuery = (options: MeasurementQueryOptions, tags: QueryTag[]): void => {
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: {
            ...state.measurementsState.options.query,
            Options: options
          },
          tags: tags
        }
      }
    })
    onChangeMeasurementQuery({
      ...state.measurementsState.options.query,
      Options: options
    })
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(state.databases), state.measurementsState.options.query.Database)}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {state.measurementsState.options.filter.Database &&
        <InlineFieldRow>
          <InlineField label="Measurement" labelWidth={20} tooltip="Specify measurement to work with, you can use regex by entering your pattern between forward slashes">
            <AsyncSelect
              value={selectedMeasurement()}
              placeholder="select measurement"
              loadOptions={loadMeasurementOptions}
              defaultOptions={defaultMeasurementOptions()}
              onChange={onMeasurementChange}
              menuShouldPortal
              allowCustomValue
              onCreateOption={handleCustomMeasurement}
            />
          </InlineField>
        </InlineFieldRow>
      }
      {state.measurementsState.options.query.Database &&
        <QueryOptions
          state={state.measurementsState.options.query.Options}
          tags={state.measurementsState.options.tags}
          appIsAlertingType={appIsAlertingType}
          onChange={handleChangeMeasurementQuery}
        />
      }
    </div>
  )
}
