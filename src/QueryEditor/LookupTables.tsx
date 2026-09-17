import React, { useEffect, useState } from 'react'
import { SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { InlineField, InlineFieldRow, MultiSelect, Select } from '@grafana/ui'
import { DataSource } from 'datasource'
import { labelWidth, LookupTable, LookupTableQuery } from 'types'
import { emptyLookupTableFilter, LookupTableFilterGroup } from './LookupTableFilterGroup'
import { selectable } from './util'
import { notifyError } from 'util/notify'

export interface Props {
  datasource: DataSource
  query: LookupTableQuery
  onChangeLookupTableQuery(query: LookupTableQuery): void
}

function templateVariables(): Array<SelectableValue<string>> {
  return getTemplateSrv()
    .getVariables()
    .map((e) => ({ label: `$${e.name}`, value: `$${e.name}` }))
}

export const LookupTables = (props: Props): JSX.Element => {
  const [loading, setLoading] = useState(true)
  const [lookupTables, setLookupTables] = useState<LookupTable[]>([])

  useEffect(() => {
    // A historian without the lookup table endpoints answers this with a 404, as does one
    // that is simply unreachable. Left to reject, the load would never clear and the editor
    // would render nothing at all, so the failure is surfaced and the editor goes on with an
    // empty list of tables.
    let cancelled = false
    const load = async () => {
      try {
        const tables = await props.datasource.getLookupTables()
        if (!cancelled) {
          setLookupTables(tables)
        }
      } catch (error) {
        if (!cancelled) {
          notifyError('Failed to load lookup tables', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [props.datasource])

  // A variable naming the table is resolved before the definition is looked up, the way the
  // query resolves it when it runs: the picker holds "$table", and every column picker below
  // is built from the table it stands for.
  const selectedTable = lookupTables.find((e) => e.UUID === props.datasource.replace(props.query.LookupTable ?? ''))
  const columns = selectedTable?.Attributes?.Columns ?? []

  const selectableTables: Array<SelectableValue<string>> = [
    ...templateVariables(),
    ...lookupTables.map((table) => ({
      label: table.Name,
      value: table.UUID,
      description: table.Attributes?.Description,
    })),
  ]

  const selectableColumns: Array<SelectableValue<string>> = columns.map((column) => ({
    label: column.Name,
    value: column.Name,
    description: column.Type,
  }))

  const onChangeTable = (event: SelectableValue<string>): void => {
    // The columns of the previous table mean nothing under the new one, so the projection
    // and the filter are dropped rather than left pointing at names it does not have.
    props.onChangeLookupTableQuery({ LookupTable: event.value ?? '', Columns: [] })
  }

  const onChangeColumns = (events: Array<SelectableValue<string>>): void => {
    props.onChangeLookupTableQuery({
      ...props.query,
      Columns: events.map((e) => e.value ?? '').filter((e) => e !== ''),
    })
  }

  return (
    <>
      {!loading && (
        <>
          <InlineFieldRow>
            <InlineField label="Lookup table" grow labelWidth={labelWidth} tooltip="The lookup table to read">
              <Select
                value={selectable(selectableTables, props.query.LookupTable)}
                placeholder="select lookup table"
                options={selectableTables}
                onChange={onChangeTable}
              />
            </InlineField>
          </InlineFieldRow>
          {props.query.LookupTable && (
            <>
              <InlineFieldRow>
                <InlineField
                  label="Columns"
                  grow
                  labelWidth={labelWidth}
                  tooltip="The columns to return. Leave empty to return every column of the table."
                >
                  <MultiSelect
                    value={props.query.Columns ?? []}
                    placeholder="all columns"
                    options={selectableColumns}
                    onChange={onChangeColumns}
                  />
                </InlineField>
              </InlineFieldRow>
              <LookupTableFilterGroup
                label="Filters"
                filter={props.query.Filter ?? emptyLookupTableFilter}
                columns={selectableColumns}
                templateVariables={templateVariables()}
                onChange={(filter) => props.onChangeLookupTableQuery({ ...props.query, Filter: filter })}
              />
            </>
          )}
        </>
      )}
    </>
  )
}
