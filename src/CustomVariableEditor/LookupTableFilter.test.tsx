import React from 'react'
import { SelectableValue } from '@grafana/data'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LookupTableFilterRow } from './LookupTableFilter'
import { DataSource } from 'datasource'
import { LookupTable } from 'types'
import { notifyError } from 'util/notify'

// Test doubles for the Grafana form controls: a select carrying its options, so a test can
// read what the editor offers and pick from it. The filter builder renders through the same
// doubles, which is why the buttons and the styles hook are here too.
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
    InlineField: ({ label, children }: { label?: string; children: React.ReactNode }) => (
      <div>
        {label && <label>{label}</label>}
        {children}
      </div>
    ),
    InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    IconButton: ({ 'aria-label': label, onClick }: { 'aria-label': string; onClick: () => void }) => (
      <button aria-label={label} onClick={onClick} />
    ),
    Select: asSelect,
    MultiSelect: ({
      'aria-label': label,
      onChange,
    }: {
      'aria-label': string
      onChange: (values: Array<SelectableValue<string>>) => void
    }) => <input aria-label={label} onChange={(e) => onChange(e.target.value.split(',').map((value) => ({ value })))} />,
    useStyles2: () => ({}),
  }
})

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
    expect(options).toEqual(['label', 'number', '$table'])

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
    expect(options).toEqual(['label', 'number', '$table'])
  })

  // A variable lists the values of the rows a filter keeps, which is what lets one variable
  // stand on another: the condition names a column of the table and the value can be a
  // variable of its own.
  it('carries a filter on the rows the values are read from', async () => {
    const onChange = jest.fn()
    render(
      <LookupTableFilterRow
        datasource={datasource}
        initialValue={{ LookupTable: 'a-uuid', ValueColumn: 'label' }}
        templateVariables={templateVariables}
        onChange={onChange}
      />
    )

    await waitFor(() => expect(screen.getByText('Add condition')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Add condition'))

    expect(onChange).toHaveBeenCalledWith(
      {
        LookupTable: 'a-uuid',
        ValueColumn: 'label',
        Filter: { Condition: 'and', ConditionGroups: [{ Column: '', Operator: 'IN', Values: [] }] },
      },
      true
    )
  })

  // The filter is no part of what makes a variable worth running: a table and the column to
  // read are, and a filter narrowing nothing leaves the variable as valid as it was.
  it('keeps a variable valid while its filter is being filled in', async () => {
    const onChange = jest.fn()
    render(
      <LookupTableFilterRow
        datasource={datasource}
        initialValue={{ LookupTable: 'a-uuid', ValueColumn: 'label' }}
        templateVariables={templateVariables}
        onChange={onChange}
      />
    )

    await waitFor(() => expect(screen.getByText('Add condition')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Add condition'))

    expect(onChange).toHaveBeenCalledWith(expect.anything(), true)
  })
})
