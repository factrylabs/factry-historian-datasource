import React, { useEffect, useState } from 'react'
import { css } from '@emotion/css'
import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { IconButton, InlineField, InlineFieldRow, Input, MultiSelect, Select, useStyles2 } from '@grafana/ui'
import { DataSource } from 'datasource'
import { labelWidth, LookupTable, LookupTablePaging, LookupTableQuery } from 'types'
import { emptyLookupTableFilter, LookupTableFilterGroup } from './LookupTableFilterGroup'
import { selectable } from './util'
import { notifyError } from 'util/notify'

export interface Props {
  datasource: DataSource
  query: LookupTableQuery
  /** The frame the query returned on its last run, which carries where its rows sit. */
  result?: DataFrame
  onChangeLookupTableQuery(query: LookupTableQuery): void
}

function templateVariables(): Array<SelectableValue<string>> {
  return getTemplateSrv()
    .getVariables()
    .map((e) => ({ label: `$${e.name}`, value: `$${e.name}` }))
}

/**
 * Reads an entered whole number as one, so the page buttons can count from it, and a variable
 * as itself. Anything else is null: a typo resolves to 0, which would load every row, and a
 * fraction is truncated when the query runs.
 */
function toQueryNumber(value: string): number | string | undefined | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }

  if (trimmed.startsWith('$')) {
    return trimmed
  }

  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function pageCount(paging: LookupTablePaging): number {
  return Math.max(Math.ceil(paging.TotalRows / paging.Limit), 1)
}

function pagingText(paging: LookupTablePaging): string {
  if (paging.TotalRows === 0) {
    return 'No rows'
  }

  if (paging.Limit === 0) {
    return `${paging.TotalRows} rows`
  }

  if (paging.Rows === 0) {
    return `No rows on page ${paging.Page}, the last page is ${pageCount(paging)} (${paging.TotalRows} rows)`
  }

  const first = (paging.Page - 1) * paging.Limit + 1
  return `Rows ${first} to ${first + paging.Rows - 1} of ${paging.TotalRows} (page ${paging.Page} of ${pageCount(
    paging
  )})`
}

export const LookupTables = (props: Props): JSX.Element => {
  const styles = useStyles2(getStyles)
  const [loading, setLoading] = useState(true)
  const [lookupTables, setLookupTables] = useState<LookupTable[]>([])
  const [limit, setLimit] = useState(String(props.query.Limit ?? ''))
  const [page, setPage] = useState(String(props.query.Page ?? ''))
  // The result shown when the rows last changed. It describes other rows, so it shows no paging.
  const [staleResult, setStaleResult] = useState<DataFrame>()

  // The page buttons and a change narrowing the rows move the page from outside the box.
  useEffect(() => setLimit(String(props.query.Limit ?? '')), [props.query.Limit])
  useEffect(() => setPage(String(props.query.Page ?? '')), [props.query.Page])

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

  const variables = templateVariables()

  // The variables follow what the list is of, which is where every other picker in the plugin
  // holds them.
  const selectableTables: Array<SelectableValue<string>> = [
    ...lookupTables.map((table) => ({
      label: table.Name,
      value: table.UUID,
      description: table.Attributes?.Description,
    })),
    ...variables,
  ]

  // A variable carries the type of the column it stands for, which is what the filter editor
  // reads to decide whether the column can be ordered. It is resolved the way the query
  // resolves it when it runs, so a variable standing for a number column is offered the
  // orderings, and one standing for nothing is offered the operators every column has.
  const selectableColumns: Array<SelectableValue<string>> = [
    ...columns.map((column) => ({
      label: column.Name,
      value: column.Name,
      description: column.Type,
    })),
    ...variables.map((variable) => ({
      ...variable,
      description: columns.find((column) => column.Name === props.datasource.replace(variable.value ?? ''))?.Type,
    })),
  ]

  // A change to which rows match, or to how many fit on a page, starts over on the first page,
  // so it never lands past the last one. A page held by a variable stays: the variable owns it.
  const firstPage = (): number | string | undefined =>
    typeof props.query.Page === 'string' ? props.query.Page : undefined

  const onChangeRows = (query: LookupTableQuery): void => {
    setStaleResult(props.result)
    props.onChangeLookupTableQuery(query)
  }

  const onChangeTable = (event: SelectableValue<string>): void => {
    // The columns of the previous table mean nothing under the new one, so the projection
    // and the filter are dropped rather than left pointing at names it does not have. The
    // limit holds for any table, and the page starts over.
    onChangeRows({
      LookupTable: event.value ?? '',
      Columns: [],
      Limit: props.query.Limit,
      Page: firstPage(),
    })
  }

  const onChangeColumns = (events: Array<SelectableValue<string>>): void => {
    props.onChangeLookupTableQuery({
      ...props.query,
      Columns: events.map((e) => e.value ?? '').filter((e) => e !== ''),
    })
  }

  const onChangeLimit = (): void => {
    const value = toQueryNumber(limit)
    if (value === null) {
      setLimit(String(props.query.Limit ?? ''))
    } else if (value !== props.query.Limit) {
      onChangeRows({ ...props.query, Limit: value, Page: firstPage() })
    }
  }

  const onChangePage = (): void => {
    const value = toQueryNumber(page)
    // Pages start at 1. The backend would serve page 1 for a 0 while the box kept showing 0.
    if (value === null || value === 0) {
      setPage(String(props.query.Page ?? ''))
    } else if (value !== props.query.Page) {
      props.onChangeLookupTableQuery({ ...props.query, Page: value })
    }
  }

  const limited = props.query.Limit !== undefined && props.query.Limit !== 0
  // Until the query reruns, the result can still be one from another tab, which carries none.
  const custom = props.result !== staleResult ? props.result?.meta?.custom : undefined
  const paging = typeof custom?.TotalRows === 'number' ? (custom as LookupTablePaging) : undefined
  // A page held by a variable is moved by the variable, not by the buttons.
  const steppable = paging !== undefined && paging.Limit > 0 && typeof props.query.Page !== 'string'
  // The buttons count from the query, not from the result: the result still holds the old page
  // until the run a click started returns. A saved fraction runs truncated, so it counts that way.
  const currentPage = typeof props.query.Page === 'number' ? Math.max(Math.trunc(props.query.Page), 1) : 1

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
                templateVariables={variables}
                onChange={(filter) => onChangeRows({ ...props.query, Filter: filter, Page: firstPage() })}
              />
              <InlineFieldRow>
                <InlineField
                  label="Limit"
                  labelWidth={labelWidth}
                  tooltip="The most rows to return. Leave empty or 0 to return every row."
                >
                  <Input
                    value={limit}
                    placeholder="all rows"
                    onChange={(e) => setLimit(e.currentTarget.value)}
                    onBlur={onChangeLimit}
                  />
                </InlineField>
                <InlineField label="Page" tooltip="The page of rows to return, from 1">
                  <Input
                    disabled={!limited}
                    value={page}
                    placeholder="1"
                    onChange={(e) => setPage(e.currentTarget.value)}
                    onBlur={onChangePage}
                  />
                </InlineField>
              </InlineFieldRow>
              {paging && (
                <InlineFieldRow>
                  <InlineField
                    label="Rows"
                    labelWidth={labelWidth}
                    tooltip="Where the rows of the last run sit among all the rows the filter matches"
                  >
                    <div className={styles.paging}>
                      <IconButton
                        name="angle-left"
                        aria-label="previous page"
                        disabled={!steppable || currentPage <= 1}
                        onClick={() =>
                          props.onChangeLookupTableQuery({
                            ...props.query,
                            Page: Math.min(currentPage - 1, pageCount(paging)),
                          })
                        }
                      />
                      <span>{pagingText(paging)}</span>
                      <IconButton
                        name="angle-right"
                        aria-label="next page"
                        disabled={!steppable || currentPage >= pageCount(paging)}
                        onClick={() => props.onChangeLookupTableQuery({ ...props.query, Page: currentPage + 1 })}
                      />
                    </div>
                  </InlineField>
                </InlineFieldRow>
              )}
            </>
          )}
        </>
      )}
    </>
  )
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // The text sits on the line of the label beside it, between the buttons that move it.
    paging: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      height: theme.spacing(theme.components.height.md),
    }),
  }
}
