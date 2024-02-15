import React, { ChangeEvent } from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect, Checkbox, InlineField, InlineFieldRow, Input, VerticalGroup } from '@grafana/ui'
import { DataSource } from 'datasource'
import { measurementToSelectableValue, useDebounce } from 'QueryEditor/util'
import { Measurement, MeasurementFilter, MeasurementQuery, TimeseriesDatabase, labelWidth } from 'types'

export interface Props {
  query: MeasurementQuery
  datasource: DataSource
  databases: TimeseriesDatabase[] | undefined
  measurements: Measurement[]
  selectedDatabases: string[] | undefined
  templateVariables: Array<SelectableValue<string>>
  onChange: (values: string[]) => void
  onChangeIsRegex: (value: boolean) => void
  onChangeRegex: (value: string) => void
}

export const MeasurementSelect = (props: Props): React.JSX.Element => {
  const [regex, setRegex] = useDebounce<string>(props.query.Regex ?? '', 500, props.onChangeRegex)

  const getSelectedMeasurements = (
    query: MeasurementQuery,
    measurements: Measurement[]
  ): Array<SelectableValue<string>> => {
    return (
      query.Measurements?.map((e) => {
        if (e.startsWith('$')) {
          return { label: e, value: e } as SelectableValue<string>
        }

        const measurement = measurements.find((measurement) => measurement.UUID === e)
        if (!measurement) {
          return { label: e, value: e } as SelectableValue<string>
        }

        return measurementToSelectableValue(measurement)
      }) ?? []
    )
  }

  const loadMeasurementOptions = async (
    query: string,
    selectedDatabases: string[] | undefined
  ): Promise<Array<SelectableValue<string>>> => {
    if (query === '/') {
      return Promise.resolve([])
    }

    const pagination = {
      Limit: 100,
      Page: 1,
    }
    const filter: MeasurementFilter = {
      Keyword: query,
      DatabaseUUIDs: selectedDatabases,
    }
    let measurements = await props.datasource.getMeasurements(filter, pagination)
    measurements = measurements.map((e) => {
      e.Database = props.databases?.find((database) => database.UUID === e.DatabaseUUID)
      return e
    })
    const selectableValues = measurements.map(measurementToSelectableValue).concat(props.templateVariables)
    return selectableValues
  }

  const onMeasurementChange = (selectedMeasurements: Array<SelectableValue<string>>): void => {
    props.onChange(selectedMeasurements.map((e) => e.value ?? ''))
  }

  const onChangeIsRegex = (event: ChangeEvent<HTMLInputElement>) => {
    props.onChangeIsRegex(event.target.checked)
  }

  const onChangeRegex = (event: ChangeEvent<HTMLInputElement>) => {
    const regex = event.target.value
    setRegex(regex)
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Measurements"
          labelWidth={labelWidth}
          tooltip="Specify measurements to work with, you can use a regex by toggling the checkbox"
        >
          <VerticalGroup>
            {!props.query.IsRegex ? (
              <AsyncMultiSelect
                value={getSelectedMeasurements(props.query, props.measurements)}
                placeholder="select measurement"
                loadOptions={(query) => loadMeasurementOptions(query, props.selectedDatabases)}
                defaultOptions
                onChange={onMeasurementChange}
                menuShouldPortal
                key={props.selectedDatabases?.length} // Forcing this component to remount when selectedDatabases changes
              />
            ) : (
              <Input value={regex} placeholder="[m|M]otor_[0-9]" onChange={onChangeRegex} />
            )}
            <Checkbox label="Use regular expression" value={props.query.IsRegex} onChange={onChangeIsRegex} />
          </VerticalGroup>
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
