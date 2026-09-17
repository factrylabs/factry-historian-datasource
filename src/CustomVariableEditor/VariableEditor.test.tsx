import React from 'react'
import { SelectableValue } from '@grafana/data'
import { render, screen, waitFor } from '@testing-library/react'
import { VariableQueryEditor } from './VariableEditor'
import { DataSource } from 'datasource'
import { HistorianInfo, VariableQuery, VariableQueryType } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

// The sub-editors are not the subject here, and one of them reaches Cascader, which needs a
// real theme at import time. Standing them down keeps the test to the query type picker.
jest.mock('./MeasurementFilter', () => ({ MeasurementFilterRow: () => null }))
jest.mock('./AssetFilter', () => ({ AssetFilterRow: () => null }))
jest.mock('./AssetPropertyFilter', () => ({ AssetPropertyFilterRow: () => null }))
jest.mock('./DatabaseFilter', () => ({ DatabaseFilterRow: () => null }))
jest.mock('./EventTypeFilter', () => ({ EventTypeFilterRow: () => null }))
jest.mock('./EventTypePropertyFilter', () => ({ EventTypePropertyFilterRow: () => null }))
jest.mock('./PropertyValuesFilter', () => ({ PropertyValuesFilterRow: () => null }))
jest.mock('./LookupTableFilter', () => ({ LookupTableFilterRow: () => null }))
jest.mock('./Pagination', () => ({ Pagination: () => null }))

// The query type picker is the whole subject here, so it is the only control the doubles
// need to carry its options.
jest.mock('@grafana/ui', () => ({
  InlineField: ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <div>
      {label && <label>{label}</label>}
      {children}
    </div>
  ),
  InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: ({ 'aria-label': label, options }: { 'aria-label': string; options: Array<SelectableValue<string>> }) => (
    <select aria-label={label}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

function datasourceOn(version: string | undefined): DataSource {
  const historianInfo: HistorianInfo | undefined = version ? ({ Version: version } as HistorianInfo) : undefined
  return {
    getInfo: jest.fn().mockResolvedValue(historianInfo),
    historianInfo,
  } as unknown as DataSource
}

function renderEditor(version: string | undefined, query: Partial<VariableQuery> = {}) {
  // Only the datasource, the query and onChange are read; the rest of the editor's props are
  // Grafana's own plumbing, which the picker never touches.
  const props = {
    datasource: datasourceOn(version),
    query: { valid: false, ...query } as VariableQuery,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  } as unknown as React.ComponentProps<typeof VariableQueryEditor>

  render(<VariableQueryEditor {...props} />)
}

const queryTypes = async () => {
  await waitFor(() => expect(screen.getByLabelText('Query type')).toBeInTheDocument())
  return Array.from(screen.getByLabelText('Query type').querySelectorAll('option')).map((o) => o.value)
}

describe('VariableQueryEditor', () => {
  it('offers the lookup table variable on a historian that supports it', async () => {
    renderEditor('v8.3.0')

    expect(await queryTypes()).toContain(VariableQueryType.LookupTableValuesQuery)
  })

  // A variable of this type could only 404 on a historian without the lookup table endpoints,
  // so it is not offered there.
  it('does not offer it on a historian that does not', async () => {
    renderEditor('v8.2.0')

    expect(await queryTypes()).not.toContain(VariableQueryType.LookupTableValuesQuery)
  })

  // An unreadable version reads as unsupported, the same way the query editor's tab does.
  it('does not offer it when the version is unknown', async () => {
    renderEditor(undefined)

    expect(await queryTypes()).not.toContain(VariableQueryType.LookupTableValuesQuery)
  })

  // A variable already saved as one keeps the option, so its own type does not go missing from
  // the list it is selected in.
  it('keeps it for a variable already saved as one', async () => {
    renderEditor('v8.2.0', { type: VariableQueryType.LookupTableValuesQuery, filter: {} })

    expect(await queryTypes()).toContain(VariableQueryType.LookupTableValuesQuery)
  })
})
