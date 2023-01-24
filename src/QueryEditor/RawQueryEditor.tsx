import React from 'react'
import { SelectableValue } from '@grafana/data'
import { CodeEditor, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import type { State, TimeseriesDatabase } from 'types'

export interface Props {
  state: State
  saveState(state: State): void
  onChangeRawQuery(queryString: string): void
  onRunQuery: () => void
}

export const RawQueryEditor = ({
  state, saveState,
  onRunQuery, onChangeRawQuery
}: Props): JSX.Element => {
  const selectableTimeseriesDatabases = (databases: TimeseriesDatabase[]): Array<SelectableValue<string>> => {
    const result: Array<SelectableValue<string>> = [{ label: 'All databases', value: '' }]
    databases.forEach((database) => {
      result.push({ label: database.Name, value: database.UUID, description: database.Description })
    })
    return result
  }

  const getTimeseriesDatabaseType = (database: string): string => {
    return state.databases.find(e => e.UUID === database)?.TimeseriesDatabaseType?.Name || 'Unknown database type'
  }

  const onUpdateQuery = (query: string): void => {
    onChangeRawQuery(query)
    onRunQuery()
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    saveState({
      ...state,
      rawState: {
        ...state.rawState,
        filter: { ...state.rawState.filter, Database: event.value }
      }
    })
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" grow labelWidth={20} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(state.databases), state.rawState.filter.Database)}
            placeholder="select timeseries database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {state.rawState.filter.Database &&
        <InlineFieldRow>
          <InlineField label={`${getTimeseriesDatabaseType(state.rawState.filter.Database)} query`} grow labelWidth={20} tooltip="">
            <CodeEditor
              height={'200px'}
              language="sql"
              onBlur={onUpdateQuery}
              onSave={onUpdateQuery}
              showMiniMap={false}
              showLineNumbers={true}
              readOnly={state.rawState.filter.Database === ''}
              value={state.rawState.rawQuery.Query}
            />
          </InlineField>
        </InlineFieldRow>
      }
    </div>
  )
}
