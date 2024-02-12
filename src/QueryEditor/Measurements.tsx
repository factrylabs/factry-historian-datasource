import React from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect, InlineField, InlineFieldRow } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { DataSource } from 'datasource'
import { QueryTag } from 'components/TagsSection/types'
import { isRegex, toSelectableValue } from 'components/TagsSection/util'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { QueryOptions } from './QueryOptions'
import { measurementToSelectableValue } from './util'
import { labelWidth, Measurement, MeasurementQuery, MeasurementQueryOptions, QueryEditorState } from 'types'

export interface Props {
  state: QueryEditorState
  appIsAlertingType: boolean
  datasource: DataSource
  templateVariables: Array<SelectableValue<string>>
  saveState(state: QueryEditorState): void
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
  loadMeasurementOptions: (query: string) => Promise<Measurement[]>
}

export const Measurements = (props: Props): JSX.Element => {
  const onTimeseriesDatabaseChange = (values: string[]): void => {
    const updatedQuery = {
      ...props.state.measurementsState.options.query,
      Databases: values,
    } as MeasurementQuery
    props.state.measurementsState.options.filter = {
      ...props.state.measurementsState.options.filter,
      DatabaseUUIDs: values,
    }
    props.loadMeasurementOptions('')
    props.saveState({
      ...props.state,
      measurementsState: {
        ...props.state.measurementsState,
        options: {
          ...props.state.measurementsState.options,
          query: updatedQuery,
          filter: { ...props.state.measurementsState.options.filter, DatabaseUUIDs: values },
        },
      },
    })
    props.onChangeMeasurementQuery(updatedQuery)
  }

  // getMeasurementOptions is called to show the filtered search results
  const getMeasurementOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    if (query === '/') {
      return Promise.resolve([])
    }

    const measurements = await props.loadMeasurementOptions(getTemplateSrv().replace(query))
    return [...props.templateVariables, ...measurements.map(measurementToSelectableValue)]
  }

  const onMeasurementChange = (selectedMeasurements: Array<SelectableValue<string>>): void => {
    const updatedQuery = {
      ...props.state.measurementsState.options.query,
      Measurements: selectedMeasurements.map((e) => e.value ?? ''),
      Measurement: undefined,
    }

    props.saveState({
      ...props.state,
      measurementsState: {
        ...props.state.measurementsState,
        options: {
          ...props.state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: selectedMeasurements,
      },
    })
    props.onChangeMeasurementQuery(updatedQuery)
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

    const datatypes = measurements.map((e) => props.state.measurements.find((m) => m.UUID === e.value)?.Datatype)
    return Array.from(new Set(datatypes).keys()).filter((dt) => dt !== undefined) as string[]
  }

  const handleCustomMeasurement = (value: string): void => {
    if (!getTemplateSrv().containsTemplate(value) && !(value.startsWith('/') && value.endsWith('/'))) {
      return
    }

    const updatedQuery = {
      ...props.state.measurementsState.options.query,
      Measurements: [...(props.state.measurementsState.options.query.Measurements ?? []), value],
    }
    props.saveState({
      ...props.state,
      measurementsState: {
        ...props.state.measurementsState,
        options: {
          ...props.state.measurementsState.options,
          query: updatedQuery,
        },
        selectedMeasurements: [...(props.state.measurementsState.selectedMeasurements ?? []), toSelectableValue(value)],
      },
    })
    props.onChangeMeasurementQuery(updatedQuery)
  }

  const handleChangeMeasurementQuery = (options: MeasurementQueryOptions, tags: QueryTag[]): void => {
    props.saveState({
      ...props.state,
      measurementsState: {
        ...props.state.measurementsState,
        options: {
          ...props.state.measurementsState.options,
          query: {
            ...props.state.measurementsState.options.query,
            Options: options,
          },
          tags: tags,
        },
      },
    })
    props.onChangeMeasurementQuery({
      ...props.state.measurementsState.options.query,
      Options: options,
    })
  }

  const datatypesOfSelectedMeasurements = getDatatypesOfMeasurements(
    props.state.measurementsState.selectedMeasurements ?? []
  )
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Database" labelWidth={labelWidth} tooltip="Specify a time series database to work with">
          <DatabaseSelect
            datasource={props.datasource}
            templateVariables={props.templateVariables}
            initialValue={props.state.measurementsState.options.filter.DatabaseUUIDs}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {props.state.measurementsState.options.query.Databases !== undefined && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Measurements"
              labelWidth={labelWidth}
              tooltip="Specify measurements to work with, you can use regex by entering your pattern between forward slashes"
            >
              <AsyncMultiSelect
                value={props.state.measurementsState.selectedMeasurements ?? []}
                placeholder="select measurement"
                loadOptions={getMeasurementOptions}
                defaultOptions
                onChange={onMeasurementChange}
                menuShouldPortal
                allowCustomValue
                createOptionPosition="first"
                onCreateOption={handleCustomMeasurement}
              />
            </InlineField>
          </InlineFieldRow>
          <QueryOptions
            state={props.state.measurementsState.options.query.Options}
            tags={props.state.measurementsState.options.tags}
            appIsAlertingType={props.appIsAlertingType}
            datatypes={datatypesOfSelectedMeasurements}
            templateVariables={props.templateVariables}
            onChange={handleChangeMeasurementQuery}
          />
        </>
      )}
    </>
  )
}
