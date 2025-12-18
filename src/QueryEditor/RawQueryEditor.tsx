import React, { useEffect, useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { CodeEditor, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { DataSource } from 'datasource'
import { getTemplateSrv } from '@grafana/runtime'
import { selectable } from './util'
import { labelWidth, RawQuery, TimeseriesDatabase } from 'types'

export interface Props {
  datasource: DataSource
  query: RawQuery
  onChangeRawQuery (queryString: RawQuery): void
}

export const RawQueryEditor = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [databases, setDatabases] = useState<TimeseriesDatabase[]>([])

  useEffect(() => {
    const load = async () => {
      const databases = await props.datasource.getTimeseriesDatabases()
      setDatabases(databases)
      setLoading(false)
    }
    load()
  }, [props.datasource])

  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = []
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
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

  const getTimeseriesDatabaseType = (database: string): string => {
    return databases.find((e) => e.UUID === database)?.TimeseriesDatabaseType?.Name || 'Unknown database type'
  }

  const onUpdateQuery = (query: string): void => {
    props.onChangeRawQuery({
      ...props.query,
      Query: query,
    })
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    props.onChangeRawQuery({
      ...props.query,
      TimeseriesDatabase: event.value ?? '',
    })
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Database"
              grow
              labelWidth={labelWidth}
              tooltip="Specify a time series database to work with"
            >
              <Select
                value={selectable(selectableTimeseriesDatabases(databases), props.query.TimeseriesDatabase)}
                placeholder="select timeseries database"
                options={selectableTimeseriesDatabases(databases)}
                onChange={onTimeseriesDatabaseChange}
              />
            </InlineField>
          </InlineFieldRow>
          {props.query.TimeseriesDatabase && (
            <InlineFieldRow>
              <InlineField
                label={`${getTimeseriesDatabaseType(props.query.TimeseriesDatabase)} query`}
                grow
                labelWidth={labelWidth}
                tooltip=""
              >
                <CodeEditor
                  height={'200px'}
                  language="sql"
                  onBlur={onUpdateQuery}
                  onSave={onUpdateQuery}
                  showMiniMap={false}
                  showLineNumbers={true}
                  readOnly={!props.query.TimeseriesDatabase}
                  value={props.query.Query}
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </>
      )}
    </>
  )
}
