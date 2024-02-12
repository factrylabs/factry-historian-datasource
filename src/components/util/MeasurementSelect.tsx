import React, { useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { AsyncMultiSelect } from '@grafana/ui'
import { getTemplateSrv } from '@grafana/runtime'
import { DataSource } from 'datasource'
import { measurementToSelectableValue } from 'QueryEditor/util'
import { MeasurementFilter, MeasurementQuery, TimeseriesDatabase } from 'types'

export interface Props {
  query: MeasurementQuery
  datasource: DataSource
  databases: TimeseriesDatabase[] | undefined
  selectedDatabases: string[] | undefined
  templateVariables: Array<SelectableValue<string>>
  onChange: (values: string[]) => void
}

export const MeasurementSelect = (props: Props): React.JSX.Element => {
  const [selectedMeasurements, setSelectedMeasurements] = useState<Array<SelectableValue<string>>>()

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
    if (!selectedMeasurements) {
      // TODO if the measurement is not in the first 100 it won't get filled properly
      setSelectedMeasurements(
        props.query.Measurements?.map(
          (measurement) =>
            selectableValues.find((e) => e.value === measurement) ?? { label: measurement, value: measurement }
        )
      )
    }
    return selectableValues
  }

  const onMeasurementChange = (selectedMeasurements: Array<SelectableValue<string>>): void => {
    setSelectedMeasurements(selectedMeasurements)
    props.onChange(selectedMeasurements.map((e) => e.value ?? ''))
  }

  const handleCustomMeasurement = (value: string): void => {
    if (!getTemplateSrv().containsTemplate(value) && !(value.startsWith('/') && value.endsWith('/'))) {
      return
    }

    setSelectedMeasurements([...(selectedMeasurements ?? []), { label: value, value: value }])
    props.onChange([...(props.query.Measurements ?? []), value])
  }

  return (
    <>
      <AsyncMultiSelect
        value={selectedMeasurements}
        placeholder="select measurement"
        loadOptions={(query) => loadMeasurementOptions(query, props.selectedDatabases)}
        defaultOptions
        onChange={onMeasurementChange}
        menuShouldPortal
        allowCustomValue
        createOptionPosition="first"
        onCreateOption={handleCustomMeasurement}
        key={props.selectedDatabases?.length} // Forcing this component to remount when selectedDatabases changes
      />
    </>
  )
}
