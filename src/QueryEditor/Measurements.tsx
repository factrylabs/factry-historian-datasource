import React, { useEffect, useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { MeasurementSelect } from 'components/util/MeasurementSelect'
import { QueryTag } from 'components/TagsSection/types'
import { QueryOptions } from './QueryOptions'
import { tagsToQueryTags } from './util'
import {
  labelWidth,
  Measurement,
  MeasurementFilter,
  MeasurementQuery,
  MeasurementQueryOptions,
  TimeseriesDatabase,
} from 'types'

export interface Props {
  query: MeasurementQuery
  appIsAlertingType: boolean
  datasource: DataSource
  templateVariables: Array<SelectableValue<string>>
  onChangeMeasurementQuery: (query: MeasurementQuery) => void
}

export const Measurements = (props: Props): React.JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [databases, setDatabases] = useState<TimeseriesDatabase[]>()
  const [selectedMeasurements, setSelectedMeasurements] = useState<Measurement[]>()
  const [selectedDatabases, setSelectedDatabases] = useState<Array<SelectableValue<string>>>()
  const [datatypes, setDatatypes] = useState<string[]>([])

  // load the databases for the measurements component
  useEffect(() => {
    const load = async () => {
      const databases = await props.datasource.getTimeseriesDatabases()
      setDatabases(databases)
    }
    load()
  }, [props.datasource])

  // load the selected measurements for the measurements component
  useEffect(() => {
    const load = async () => {
      if (props.query.Measurements && props.query.Measurements.length > 0) {
        let selectedMeasurementsUpdate: Measurement[] = []
        const datatypes = new Set<string>()
        for (const measurement of props.query.Measurements) {
          if (measurement.startsWith('$')) {
            continue
          }

          if (!props.query.IsRegex) {
            let selectedMeasurement: Measurement | undefined
            selectedMeasurement = selectedMeasurements?.find((e) => e.UUID === measurement)
            if (!selectedMeasurement) {
              selectedMeasurement = await props.datasource.getMeasurement(measurement)
            }
            selectedMeasurementsUpdate.push(selectedMeasurement)
            datatypes.add(selectedMeasurement.Datatype)
          }
        }
        setSelectedMeasurements(selectedMeasurementsUpdate)
        setDatatypes(Array.from(datatypes))
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.datasource, props.query.Measurements])

  const onTimeseriesDatabaseChange = (values: string[]): void => {
    props.onChangeMeasurementQuery({
      ...props.query,
      Databases: values,
    })
  }

  const onMeasurementsChange = (values: string[]): void => {
    props.onChangeMeasurementQuery({
      ...props.query,
      Measurements: values,
    })
  }

  const onChangeMeasurementQueryOptions = (options: MeasurementQueryOptions, tags: QueryTag[]): void => {
    props.onChangeMeasurementQuery({
      ...props.query,
      Options: options,
    })
  }

  const onChangeIsRegex = (value: boolean): void => {
    props.onChangeMeasurementQuery({
      ...props.query,
      IsRegex: value,
    })
  }

  const onChangeRegex = (value: string): void => {
    props.onChangeMeasurementQuery({
      ...props.query,
      Regex: value,
    })
  }

  const getTagKeyOptions = async (): Promise<string[]> => {
    let options = new Set<string>()

    if (props.query.IsRegex) {
      const filter: MeasurementFilter = {
        Keyword: props.query.Regex,
        DatabaseUUIDs: props.query.Databases,
      }
      const measurementKeys = await props.datasource.getTagKeysForMeasurements(filter)
      measurementKeys.forEach((e) => options.add(e))
    } else {
      for (const measurement of props.query.Measurements ?? []) {
        const measurementKeys = await props.datasource.getTagKeysForMeasurement(measurement)
        measurementKeys.forEach((e) => options.add(e))
      }
    }

    return Array.from(options)
  }

  const getTagValueOptions = async (key: string): Promise<string[]> => {
    let options = new Set<string>()

    if (props.query.IsRegex) {
      const filter: MeasurementFilter = {
        Keyword: props.query.Regex,
        DatabaseUUIDs: props.query.Databases,
      }
      const tagValues = await props.datasource.getTagValuesForMeasurements(filter, key)
      tagValues.forEach((e) => options.add(e))
    } else {
      for (const measurement of props.query.Measurements ?? []) {
        const tagValues = await props.datasource.getTagValuesForMeasurement(measurement, key)
        tagValues.forEach((e) => options.add(e))
      }
    }

    return Array.from(options)
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField label="Database" labelWidth={labelWidth} tooltip="Specify a time series database to work with">
              <DatabaseSelect
                datasource={props.datasource}
                templateVariables={props.templateVariables}
                initialValue={props.query.Databases}
                selectedDatabases={selectedDatabases}
                setSelectedDatabases={setSelectedDatabases}
                onChange={onTimeseriesDatabaseChange}
              />
            </InlineField>
          </InlineFieldRow>

          <MeasurementSelect
            query={props.query}
            datasource={props.datasource}
            databases={databases}
            measurements={selectedMeasurements ?? []}
            selectedDatabases={selectedDatabases?.map((e) => e.value ?? '')}
            templateVariables={props.templateVariables}
            onChange={onMeasurementsChange}
            onChangeIsRegex={onChangeIsRegex}
            onChangeRegex={onChangeRegex}
          />
          <QueryOptions
            state={props.query.Options}
            tags={tagsToQueryTags(props.query.Options?.Tags)}
            appIsAlertingType={props.appIsAlertingType}
            datatypes={datatypes}
            templateVariables={props.templateVariables}
            getTagKeyOptions={getTagKeyOptions}
            getTagValueOptions={getTagValueOptions}
            onChange={onChangeMeasurementQueryOptions}
          />
        </>
      )}
    </>
  )
}
