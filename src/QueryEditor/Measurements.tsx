import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect, InlineField, InlineFieldRow, InputActionMeta, Select } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { QueryTag } from 'components/TagsSection/types'
import { selectable } from './util'
import { QueryOptions } from './QueryOptions'
import { labelWidth, MeasurementQuery, MeasurementQueryOptions, QueryEditorState, TimeseriesDatabase } from 'types'
import { toSelectableValue } from 'components/TagsSection/util'

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
  // TODO when grafana 9.4.x is released add createOptionPosition={'first'} to the measurement selection and any other select's that allow custom values
  const [measurementOptions, setMeasurementOptions] = useState([] as Array<SelectableValue<string>>)
  const [measurementInput, setMeasurementInput] = useState("")
  const [measurementSelected, setMeasurementSelected] = useState(false)

  const selectedMeasurements = (): Array<SelectableValue<string>> => {
    return state.measurementsState.selectedMeasurements ?? []
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
    if (query === '/') {
      return Promise.resolve([])
    }

    const options = await onLoadMeasurementOptions(getTemplateSrv().replace(query))
    setMeasurementOptions([...options])
    return [
      ...getTemplateSrv().getVariables().map((e => {
        return { label: `$${e.name}`, value: `$${e.name}` }
      })),
      ...options
    ]
  }

  const onMeasurementChange = (events: Array<SelectableValue<string>>): void => {
    if (events.length > 0) {
      setMeasurementSelected(true)
    }
    const updatedQuery = { ...state.measurementsState.options.query, Measurements: events.map(e => e.value ?? ''), Measurement: undefined }
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: events,
      }
    })
    onChangeMeasurementQuery(updatedQuery)
  }

  const onMeasurementInput = (value: string, actionMeta: InputActionMeta): void => {
    if (actionMeta.action === 'input-change' || actionMeta.action === 'set-value') {
      setMeasurementInput(value)
    }
  }

  const onMeasurementFocus = (): void => {
    setMeasurementSelected(false)
    setMeasurementInput("")
  }

  const onMeasurementBlur = (): void => {
    if (!measurementInput || measurementSelected) {
      return
    }

    handleCustomMeasurement(measurementInput)
  }

  const handleCustomMeasurement = (value: string): void => {
    setMeasurementSelected(true)
    if (!getTemplateSrv().containsTemplate(value) && !(value.startsWith('/') && value.endsWith('/'))) {
      const measurementOption = measurementOptions.find((e => e.label === value))
      if (measurementOption) {
        onMeasurementChange([...(state.measurementsState.selectedMeasurements ?? []), measurementOption])
      }
      return
    }

    const updatedQuery = { ...state.measurementsState.options.query, Measurements: [...(state.measurementsState.options.query.Measurements ?? []), value] }
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: [...(state.measurementsState.selectedMeasurements ?? []), toSelectableValue(value)]
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
    state.measurementsState.options.filter = { ...state.measurementsState.options.filter, DatabaseUUID: databaseUUID }
    onLoadMeasurementOptions('')
    saveState({
      ...state,
      measurementsState: {
        ...state.measurementsState,
        options: {
          ...state.measurementsState.options,
          query: updatedQuery,
          filter: { ...state.measurementsState.options.filter, DatabaseUUID: databaseUUID }
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
        <InlineField label="Database" labelWidth={labelWidth} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(state.databases), state.measurementsState.options.query.Database)}
            placeholder="select time series database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {state.measurementsState.options.filter.DatabaseUUID &&
        <InlineFieldRow>
          <InlineField label="Measurements" labelWidth={labelWidth} tooltip="Specify measurements to work with, you can use regex by entering your pattern between forward slashes">
            <AsyncMultiSelect
              value={selectedMeasurements()}
              placeholder="select measurement"
              loadOptions={loadMeasurementOptions}
              defaultOptions={defaultMeasurementOptions()}
              onChange={onMeasurementChange}
              menuShouldPortal
              allowCustomValue
              onCreateOption={handleCustomMeasurement}
              onInputChange={onMeasurementInput}
              onFocus={onMeasurementFocus}
              onBlur={onMeasurementBlur}
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
