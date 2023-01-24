import React from 'react'
import { SelectableValue } from '@grafana/data'
import { CodeEditor, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import type { MeasurementFilter, TimeseriesDatabase } from 'types'

export interface Props {
  databases: TimeseriesDatabase[]
  filter: MeasurementFilter
  query: string
  onChangeRawQuery(queryString: string): void
  onRunQuery: () => void
  onTimeseriesDatabaseChange: (database: SelectableValue<string>) => void
}

export const RawQueryEditor = ({
  databases, filter, query,
  onRunQuery, onChangeRawQuery,
  onTimeseriesDatabaseChange
}: Props): JSX.Element => {
  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return result
  }

  const getTimeseriesDatabaseType = (database: string): string => {
    return databases.find(e => e.UUID === database)?.TimeseriesDatabaseType?.Name || 'Unknown database type'
  }

  const onUpdateQuery = (query: string): void => {
    onChangeRawQuery(query)
    onRunQuery()
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" grow labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(databases), filter.Database)}
            placeholder="select timeseries database"
            options={selectableTimeseriesDatabases(databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {filter.Database &&
        <InlineFieldRow>
          <InlineField label={`${getTimeseriesDatabaseType(filter.Database)} query`} grow labelWidth={20} tooltip="">
            <CodeEditor
              height={'200px'}
              language="sql"
              onBlur={onUpdateQuery}
              onSave={onUpdateQuery}
              showMiniMap={false}
              showLineNumbers={true}
              readOnly={filter.Database === ''}
              value={query}
            />
          </InlineField>
        </InlineFieldRow>
      }
    </div>
  )
}
