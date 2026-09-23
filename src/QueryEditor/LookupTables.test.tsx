import React from 'react'
import { SelectableValue } from '@grafana/data'
import { render, screen, waitFor } from '@testing-library/react'
import { LookupTables } from './LookupTables'
import { DataSource } from 'datasource'
import { LookupTable } from 'types'
import { notifyError } from 'util/notify'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [{ name: 'table' }] }),
}))

jest.mock('util/notify', () => ({ notifyError: jest.fn() }))

// Test doubles for the Grafana form controls, each carrying its options so a test can read
// what the editor offers. The filter group renders through the same doubles.
jest.mock('@grafana/ui', () => {
  const asSelect = ({
    'aria-label': label,
    options,
    onChange,
  }: {
    'aria-label': string
    options: Array<SelectableValue<string>>
    onChange: (value: SelectableValue<string>) => void
  }) => (
    <select aria-label={label} onChange={(e) => onChange({ value: e.target.value })}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )

  return {
    // The field's control is nested in its label, which is what ties the two together for a
    // test: the editor labels these through InlineField rather than with an aria-label.
    InlineField: ({ label, children }: { label?: string; children: React.ReactNode }) =>
      label ? (
        <label>
          {label}
          {children}
        </label>
      ) : (
        <div>{children}</div>
      ),
    InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    IconButton: () => null,
    RadioButtonGroup: () => null,
    Select: asSelect,
    MultiSelect: asSelect,
    useStyles2: () => ({}),
  }
})

const lookupTable: LookupTable = {
  UUID: 'a-uuid',
  Name: 'Example',
  Attributes: {
    Columns: [
      { Name: 'label', Type: 'string' },
      { Name: 'number', Type: 'number' },
    ],
  },
}

// The datasource resolves $table the way the query does when it runs, to the table's UUID.
const datasource = {
  getLookupTables: jest.fn().mockResolvedValue([lookupTable]),
  replace: (value: string) => (value === '$table' ? 'a-uuid' : value),
} as unknown as DataSource

const columnOptions = () => Array.from(screen.getByLabelText('Columns').querySelectorAll('option')).map((o) => o.value)

describe('LookupTables', () => {
  // The table is named by a variable, so its columns can only be found by resolving it first.
  // Until they are, neither the projection nor a filter can name a column.
  it('lists the columns of the table a variable names', async () => {
    render(
      <LookupTables
        datasource={datasource}
        query={{ LookupTable: '$table', Columns: [] }}
        onChangeLookupTableQuery={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Columns')).toBeInTheDocument())
    expect(columnOptions()).toEqual(['label', 'number'])
  })

  // A historian without the lookup table endpoints answers the load with a 404. The editor
  // has to say so and carry on, rather than render nothing for as long as the tab is open.
  it('reports a failed load and still renders the form', async () => {
    const failing = {
      getLookupTables: jest.fn().mockRejectedValue(new Error('404 not found')),
      replace: (value: string) => value,
    } as unknown as DataSource

    render(
      <LookupTables
        datasource={failing}
        query={{ LookupTable: '', Columns: [] }}
        onChangeLookupTableQuery={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Lookup table')).toBeInTheDocument())
    expect(screen.getByLabelText('Lookup table').querySelectorAll('option')).toHaveLength(1)
    expect(notifyError).toHaveBeenCalledWith('Failed to load lookup tables', expect.any(Error))
  })

  it('lists the columns of a table named outright', async () => {
    render(
      <LookupTables
        datasource={datasource}
        query={{ LookupTable: 'a-uuid', Columns: [] }}
        onChangeLookupTableQuery={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Columns')).toBeInTheDocument())
    expect(columnOptions()).toEqual(['label', 'number'])
  })
})
