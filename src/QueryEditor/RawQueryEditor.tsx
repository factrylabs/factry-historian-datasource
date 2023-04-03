import React from 'react'
import { SelectableValue } from '@grafana/data'
import { CodeEditor, InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { selectable } from './util'
import { labelWidth, QueryEditorState, TimeseriesDatabase } from 'types'

export interface Props {
  state: QueryEditorState
  saveState(state: QueryEditorState): void
  onChangeRawQuery(queryString: string): void
}

export const RawQueryEditor = ({
  state, saveState,
  onChangeRawQuery
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
  }

  const onTimeseriesDatabaseChange = (event: SelectableValue<string>): void => {
    saveState({
      ...state,
      rawState: {
        ...state.rawState,
        filter: { ...state.rawState.filter, DatabaseUUID: event.value }
      }
    })
  }

  return (
    <div>
      <InlineFieldRow>
        <InlineField label="Database" grow labelWidth={labelWidth} tooltip="Specify a time series database to work with">
          <Select
            value={selectable(selectableTimeseriesDatabases(state.databases), state.rawState.filter.DatabaseUUID)}
            placeholder="select timeseries database"
            options={selectableTimeseriesDatabases(state.databases)}
            onChange={onTimeseriesDatabaseChange}
          />
        </InlineField>
      </InlineFieldRow>
      {state.rawState.filter.DatabaseUUID &&
        <InlineFieldRow>
          <InlineField label={`${getTimeseriesDatabaseType(state.rawState.filter.DatabaseUUID)} query`} grow labelWidth={labelWidth} tooltip="">
            <CodeEditor
              height={'200px'}
              language="sql"
              onBlur={onUpdateQuery}
              onSave={onUpdateQuery}
              showMiniMap={false}
              showLineNumbers={true}
              readOnly={state.rawState.filter.DatabaseUUID === ''}
              value={state.rawState.rawQuery.Query}
            />
          </InlineField>
        </InlineFieldRow>
      }
    </div>
  )
}
