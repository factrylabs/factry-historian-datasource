import React, { useEffect, useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { DatabaseSelect } from 'components/util/DatabaseSelect'
import { MeasurementSelect } from 'components/util/MeasurementSelect'
import { isRegex } from 'components/TagsSection/util'
import { QueryTag } from 'components/TagsSection/types'
import { QueryOptions } from './QueryOptions'
import { tagsToQueryTags } from './util'
import { labelWidth, MeasurementQuery, MeasurementQueryOptions, TimeseriesDatabase } from 'types'

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
  const [selectedDatabases, setSelectedDatabases] = useState<Array<SelectableValue<string>>>()
  const [datatypes, setDatatypes] = useState<string[]>([])

  // load the databases for the measurements component
  useEffect(() => {
    const load = async () => {
      const databases = await props.datasource.getTimeseriesDatabases()
      setDatabases(databases)
      setLoading(false)
    }
    load()
  }, [props.datasource])

  useEffect(() => {
    const getDatatypesOfMeasurements = async (measurements: string[]): Promise<string[]> => {
      if (
        !measurements ||
        measurements.length === 0 ||
        measurements.findIndex((e) => isRegex(e ?? '') || e.startsWith('$')) !== -1 // if any of the 'measurements' is a regex or dashboard variable
      ) {
        // no filtering of aggregations will be done with empty array
        return []
      }

      const datatypes = new Set<string>()
      for (const measurement of measurements) {
        const filter = { Keyword: measurement }
        const result = await props.datasource.getMeasurements(filter, { Page: 0, Limit: 0 })
        result.map((e) => e.Datatype).forEach((datatype) => datatypes.add(datatype))
      }

      return Array.from(datatypes)
    }
    const load = async () => {
      const datatypesOfSelectedMeasurements = await getDatatypesOfMeasurements(props.query.Measurements ?? [])
      setDatatypes(datatypesOfSelectedMeasurements)
    }
    load()
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
          <InlineFieldRow>
            <InlineField
              label="Measurements"
              labelWidth={labelWidth}
              tooltip="Specify measurements to work with, you can use regex by entering your pattern between forward slashes"
            >
              <MeasurementSelect
                query={props.query}
                datasource={props.datasource}
                databases={databases}
                selectedDatabases={selectedDatabases?.map((e) => e.value ?? '')}
                templateVariables={props.templateVariables}
                onChange={onMeasurementsChange}
              />
            </InlineField>
          </InlineFieldRow>
          <QueryOptions
            state={props.query.Options}
            tags={tagsToQueryTags(props.query.Options.Tags)}
            appIsAlertingType={props.appIsAlertingType}
            datatypes={datatypes}
            templateVariables={props.templateVariables}
            onChange={onChangeMeasurementQueryOptions}
          />
        </>
      )}
    </>
  )
}
