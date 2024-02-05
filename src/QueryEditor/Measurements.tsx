import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { QueryTag } from 'components/TagsSection/types'
import { selectable, measurementToSelectableValue } from './util'
import { QueryOptions } from './QueryOptions'
import {
  labelWidth,
  Measurement,
  MeasurementQuery,
  MeasurementQueryOptions,
  QueryEditorState,
  TimeseriesDatabase,
} from 'types'
import { isRegex, toSelectableValue } from 'components/TagsSection/util'

export interface Props {
  state: QueryEditorState
  appIsAlertingType: boolean
  saveState(state: QueryEditorState): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  loadMeasurementOptions: (query: string) => Promise<Measurement[]>
}

export const Measurements = ({
  state,
  appIsAlertingType,
  saveState,
  onChangeMeasurementQuery,
  loadMeasurementOptions,
}: Props): JSX.Element => {
  // TODO when grafana 9.4.x is released add createOptionPosition={'first'} to the measurement selection and any other select's that allow custom values

  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result = databases.map((database) => {
      return { label: database.Name, value: database.UUID, description: database.Description }
    })
    return [
      ...getTemplateSrv()
        .getVariables()
        .map((e) => {
          return { label: `$${e.name}`, value: `$${e.name}` }
        }),
      ...result,
    ]
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    let databaseUUID = event.value
    if (getTemplateSrv().containsTemplate(event.value)) {
      databaseUUID = state.databases.find((e) => (e.Name = getTemplateSrv().replace(event.value)))?.UUID
    }
    const updatedQuery = { ...state.measurementsState.options.query, Database: event.value } as MeasurementQuery
    state.measurementsState.options.filter = { ...state.measurementsState.options.filter, DatabaseUUID: databaseUUID }
    loadMeasurementOptions('')
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
          filter: { ...state.measurementsState.options.filter, DatabaseUUID: databaseUUID },
        },
      },
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  // getMeasurementOptions is called to show the filtered search results
  const getMeasurementOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    if (query === '/') {
      return Promise.resolve([])
    }

    const measurements = await loadMeasurementOptions(getTemplateSrv().replace(query))
    return [
      ...getTemplateSrv()
        .getVariables()
        .map((e) => {
          return { label: `$${e.name}`, value: `$${e.name}` }
        }),
      ...measurements.map(measurementToSelectableValue),
    ]
  }

  const onMeasurementChange = (selectedMeasurements: Array<SelectableValue<string>>): void => {
    const updatedQuery = {
      ...state.measurementsState.options.query,
      Measurements: selectedMeasurements.map((e) => e.value ?? ''),
      Measurement: undefined,
    }

    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: selectedMeasurements,
      },
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  const getDatatypesOfMeasurements = (measurements: Array<SelectableValue<string>>): string[] => {
    if (
      !measurements ||
      measurements.length === 0 ||
      measurements.findIndex((e) => isRegex(e.value ?? '') || isRegex(e.label ?? '')) !== -1 // if any of the 'measurements' is a regex
    ) {
      // no filtering of aggregations will be done with empty array
      return []
    }

    const datatypes = measurements.map((e) => state.measurements.find((m) => m.UUID === e.value)?.Datatype)
    return Array.from(new Set(datatypes).keys()).filter((dt) => dt !== undefined) as string[]
  }

  const handleCustomMeasurement = (value: string): void => {
    if (!getTemplateSrv().containsTemplate(value) && !(value.startsWith('/') && value.endsWith('/'))) {
      return
    }

    const updatedQuery = {
      ...state.measurementsState.options.query,
      Measurements: [...(state.measurementsState.options.query.Measurements ?? []), value],
    }
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: [...(state.measurementsState.selectedMeasurements ?? []), toSelectableValue(value)],
      },
    })
    onChangeMeasurementQuery(updatedQuery)
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
            Options: options,
          },
          tags: tags,
        },
      },
    })
    onChangeMeasurementQuery({
      ...state.measurementsState.options.query,
      Options: options,
    })
  }

  const datatypesOfSelectedMeasurements = getDatatypesOfMeasurements(state.measurementsState.selectedMeasurements ?? [])
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={labelWidth} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(
              selectableTimeseriesDatabases(state.databases),
              state.measurementsState.options.query.Database
            )}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {state.measurementsState.options.filter.DatabaseUUID && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Measurements"
              labelWidth={labelWidth}
              tooltip="Specify measurements to work with, you can use regex by entering your pattern between forward slashes"
            >
              <AsyncMultiSelect
                value={state.measurementsState.selectedMeasurements ?? []}
                placeholder="select measurement"
                loadOptions={getMeasurementOptions}
                defaultOptions
                onChange={onMeasurementChange}
                menuShouldPortal
                allowCustomValue
                onCreateOption={handleCustomMeasurement}
              />
            </InlineField>
          </InlineFieldRow>
          <QueryOptions
            state={state.measurementsState.options.query.Options}
            tags={state.measurementsState.options.tags}
            appIsAlertingType={appIsAlertingType}
            datatypes={datatypesOfSelectedMeasurements}
            onChange={handleChangeMeasurementQuery}
          />
        </>
      )}
    </>
  )
}
