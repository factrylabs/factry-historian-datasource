import React, { useEffect, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow, Select } from '@grafana/ui'
import { DataSource } from 'datasource'
import { fieldWidth, labelWidth, LookupTable, LookupTableValuesFilter } from 'types'
import { notifyError } from 'util/notify'

export function LookupTableFilterRow(props: {
  datasource: DataSource
  onChange: (val: LookupTableValuesFilter, valid: boolean) => void
  initialValue?: LookupTableValuesFilter
  templateVariables: Array<SelectableValue<string>>
}) {
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

  const filter = props.initialValue ?? {}
  // A variable naming the table is resolved before the definition is looked up, the way the
  // variable resolves it when it runs: the picker holds "$table", and the column pickers below
  // are built from the table it stands for. Without this the variable could never be marked
  // valid, since its value column is picked from that list.
  const columns =
    lookupTables.find((e) => e.UUID === props.datasource.replace(filter.LookupTable ?? ''))?.Attributes?.Columns ?? []

  const selectableTables: Array<SelectableValue<string>> = [
    ...props.templateVariables,
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

  // A filter is only worth running once it names a table and the column to read. Until then
  // it is marked invalid, which is what keeps the variable from querying on every keystroke.
  const change = (next: LookupTableValuesFilter): void => {
    props.onChange(next, Boolean(next.LookupTable) && Boolean(next.ValueColumn))
  }

  return loading ? (
    <></>
  ) : (
    <>
      <InlineFieldRow>
        <InlineField label="Lookup table" labelWidth={labelWidth} tooltip={<div>The lookup table to read</div>}>
          <Select
            placeholder="select lookup table"
            aria-label="Lookup table"
            width={fieldWidth}
            options={selectableTables}
            value={filter.LookupTable}
            // The columns of the previous table mean nothing under the new one, so both
            // selections are dropped rather than left naming columns it does not have.
            onChange={(value) => change({ LookupTable: value.value ?? '' })}
          />
        </InlineField>
      </InlineFieldRow>
      {filter.LookupTable && (
        <>
          <InlineFieldRow>
            <InlineField
              label="Value column"
              labelWidth={labelWidth}
              tooltip={<div>The column holding the value the variable resolves to in a query</div>}
            >
              <Select
                placeholder="select column"
                aria-label="Value column"
                width={fieldWidth}
                options={selectableColumns}
                value={filter.ValueColumn}
                onChange={(value) => change({ ...filter, ValueColumn: value.value ?? '' })}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Display column"
              labelWidth={labelWidth}
              tooltip={
                <div>
                  Optional. The column shown in the variable&apos;s dropdown. Leave empty to show the value itself.
                </div>
              }
            >
              <Select
                placeholder="same as value column"
                aria-label="Display column"
                width={fieldWidth}
                isClearable
                options={selectableColumns}
                value={filter.TextColumn}
                onChange={(value) => change({ ...filter, TextColumn: value?.value ?? undefined })}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
    </>
  )
}
