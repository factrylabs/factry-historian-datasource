import React from 'react'
import { SelectableValue } from '@grafana/data'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LookupTableFilterRow } from './LookupTableFilter'
import { DataSource } from 'datasource'
import { LookupTable } from 'types'
import { notifyError } from 'util/notify'

// Test doubles for the Grafana form controls: a select carrying its options, so a test can
// read what the editor offers and pick from it.
jest.mock('@grafana/ui', () => ({
  InlineField: ({ label, children }: { label?: string; children: React.ReactNode }) => (
    <div>
      {label && <label>{label}</label>}
      {children}
    </div>
  ),
  InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: ({
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
  ),
}))

jest.mock('util/notify', () => ({ notifyError: jest.fn() }))

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

// The datasource resolves $table the way the running variable does, to the table's UUID.
const datasource = {
  getLookupTables: jest.fn().mockResolvedValue([lookupTable]),
  replace: (value: string) => (value === '$table' ? 'a-uuid' : value),
} as unknown as DataSource

const templateVariables: Array<SelectableValue<string>> = [{ label: '$table', value: '$table' }]

describe('LookupTableFilterRow', () => {
  // The table is named by a variable, so the columns can only be found by resolving it first.
  // Until they are, the value column cannot be picked and the variable can never be valid.
  it('lists the columns of the table a variable names', async () => {
    const onChange = jest.fn()
    render(
      <LookupTableFilterRow
        datasource={datasource}
        initialValue={{ LookupTable: '$table' }}
        templateVariables={templateVariables}
        onChange={onChange}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Value column')).toBeInTheDocument())

    const options = Array.from(screen.getByLabelText('Value column').querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['label', 'number'])

    fireEvent.change(screen.getByLabelText('Value column'), { target: { value: 'label' } })
    expect(onChange).toHaveBeenCalledWith({ LookupTable: '$table', ValueColumn: 'label' }, true)
  })

  // The same 404 reaches this editor, and the same rule applies: say so, and leave the table
  // picker standing rather than rendering nothing.
  it('reports a failed load and still renders the form', async () => {
    const failing = {
      getLookupTables: jest.fn().mockRejectedValue(new Error('404 not found')),
      replace: (value: string) => value,
    } as unknown as DataSource

    render(
      <LookupTableFilterRow
        datasource={failing}
        initialValue={{}}
        templateVariables={templateVariables}
        onChange={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Lookup table')).toBeInTheDocument())
    expect(notifyError).toHaveBeenCalledWith('Failed to load lookup tables', expect.any(Error))
  })

  it('lists the columns of a table named outright', async () => {
    render(
      <LookupTableFilterRow
        datasource={datasource}
        initialValue={{ LookupTable: 'a-uuid' }}
        templateVariables={templateVariables}
        onChange={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('Value column')).toBeInTheDocument())

    const options = Array.from(screen.getByLabelText('Value column').querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['label', 'number'])
  })
})
