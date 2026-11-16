import React from 'react'
import { DataFrame, SelectableValue } from '@grafana/data'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LookupTables } from './LookupTables'
import { DataSource } from 'datasource'
import { LookupTable, LookupTableQuery } from 'types'
import { notifyError } from 'util/notify'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [{ name: 'table' }, { name: 'col' }] }),
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
    IconButton: ({
      'aria-label': label,
      disabled,
      onClick,
    }: {
      'aria-label': string
      disabled?: boolean
      onClick?: () => void
    }) => <button aria-label={label} disabled={disabled} onClick={onClick} />,
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
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

// The datasource resolves a variable the way the query does when it runs: $table to the
// table's UUID, $col to the name of a column of it.
const datasource = {
  getLookupTables: jest.fn().mockResolvedValue([lookupTable]),
  replace: (value: string) => ({ $table: 'a-uuid', $col: 'number' }[value] ?? value),
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
    expect(columnOptions()).toEqual(['label', 'number', '$table', '$col'])
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
    // The variables alone: a load that failed leaves no table to name.
    expect(screen.getByLabelText('Lookup table').querySelectorAll('option')).toHaveLength(2)
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
    expect(columnOptions()).toEqual(['label', 'number', '$table', '$col'])
  })

  // The column a condition names can be a variable, and the operators it is offered follow
  // the column it stands for: $col resolves to a number column, so it can be ordered.
  it('offers the orderings on a variable standing for a number column', async () => {
    render(
      <LookupTables
        datasource={datasource}
        query={{
          LookupTable: 'a-uuid',
          Columns: [],
          Filter: { Condition: 'and', ConditionGroups: [{ Column: '$col', Operator: 'IN', Values: [] }] },
        }}
        onChangeLookupTableQuery={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('operator')).toBeInTheDocument())
    const operators = Array.from(screen.getByLabelText('operator').querySelectorAll('option')).map((o) => o.value)
    expect(operators).toContain('>')
  })

  // A variable standing for nothing has no type to read, so it is offered the operators every
  // column can be compared with and none of the orderings.
  it('offers no orderings on a variable standing for no column', async () => {
    render(
      <LookupTables
        datasource={datasource}
        query={{
          LookupTable: 'a-uuid',
          Columns: [],
          Filter: { Condition: 'and', ConditionGroups: [{ Column: '$table', Operator: 'IN', Values: [] }] },
        }}
        onChangeLookupTableQuery={jest.fn()}
      />
    )

    await waitFor(() => expect(screen.getByLabelText('operator')).toBeInTheDocument())
    const operators = Array.from(screen.getByLabelText('operator').querySelectorAll('option')).map((o) => o.value)
    expect(operators).not.toContain('>')
    expect(operators).toEqual(['=', '!=', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'])
  })

  describe('limit and page', () => {
    const paged: LookupTableQuery = { LookupTable: 'a-uuid', Columns: [], Limit: 100, Page: 3 }

    const renderEditor = async (query: LookupTableQuery, result?: DataFrame) => {
      const onChange = jest.fn()
      render(<LookupTables datasource={datasource} query={query} result={result} onChangeLookupTableQuery={onChange} />)
      await waitFor(() => expect(screen.getByLabelText('Limit')).toBeInTheDocument())
      return onChange
    }

    // A frame with no fields, when the columns match none, still counts its rows in the meta.
    const resultOf = (Rows: number, TotalRows: number, Page: number, Limit = 100): DataFrame =>
      ({ fields: [], length: 0, meta: { custom: { Rows, TotalRows, Page, Limit } } } as DataFrame)

    // A new limit regroups the rows into other pages, so the page it was on may no longer exist.
    it('starts over on the first page when the limit changes', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '50' } })
      fireEvent.blur(screen.getByLabelText('Limit'))

      expect(onChange).toHaveBeenCalledWith({ ...paged, Limit: 50, Page: undefined })
    })

    it('keeps a variable as the limit', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '$limit' } })
      fireEvent.blur(screen.getByLabelText('Limit'))

      expect(onChange).toHaveBeenCalledWith({ ...paged, Limit: '$limit', Page: undefined })
    })

    // Leaving the box without changing it must not reset the page or run the query again.
    it('changes nothing when the limit is left as it was', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.blur(screen.getByLabelText('Limit'))

      expect(onChange).not.toHaveBeenCalled()
    })

    // A typo would resolve to 0 and load every row, so it is dropped rather than saved.
    it('keeps the limit and the page when the entry is neither a number nor a variable', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '1o0' } })
      fireEvent.blur(screen.getByLabelText('Limit'))
      fireEvent.change(screen.getByLabelText('Page'), { target: { value: '-2' } })
      fireEvent.blur(screen.getByLabelText('Page'))

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Limit')).toHaveValue('100')
      expect(screen.getByLabelText('Page')).toHaveValue('3')
    })

    it('keeps the limit and the page when a fraction is entered', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '2.5' } })
      fireEvent.blur(screen.getByLabelText('Limit'))
      fireEvent.change(screen.getByLabelText('Page'), { target: { value: '1.5' } })
      fireEvent.blur(screen.getByLabelText('Page'))

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Limit')).toHaveValue('100')
      expect(screen.getByLabelText('Page')).toHaveValue('3')
    })

    it('sets the page entered', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Page'), { target: { value: '5' } })
      fireEvent.blur(screen.getByLabelText('Page'))

      expect(onChange).toHaveBeenCalledWith({ ...paged, Page: 5 })
    })

    it('keeps the page when 0 is entered', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Page'), { target: { value: '0' } })
      fireEvent.blur(screen.getByLabelText('Page'))

      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Page')).toHaveValue('3')
    })

    it('only takes a page under a limit', async () => {
      await renderEditor({ LookupTable: 'a-uuid', Columns: [] })

      expect(screen.getByLabelText('Page')).toBeDisabled()
    })

    it('starts over on the first page when the filter changes', async () => {
      const onChange = await renderEditor({
        ...paged,
        Filter: { Condition: 'and', ConditionGroups: [{ Column: 'number', Operator: 'IN', Values: [] }] },
      })

      fireEvent.change(screen.getByLabelText('column'), { target: { value: 'label' } })

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ Page: undefined }))
    })

    it('keeps the limit and starts over on the first page when the table changes', async () => {
      const onChange = await renderEditor(paged)

      fireEvent.change(screen.getByLabelText('Lookup table'), { target: { value: 'a-uuid' } })

      expect(onChange).toHaveBeenCalledWith({ LookupTable: 'a-uuid', Columns: [], Limit: 100 })
    })

    // A dashboard's page dropdown stops working if an edit drops the variable it drives.
    it('keeps a variable page when the limit, the filter or the table changes', async () => {
      const onChange = await renderEditor({
        ...paged,
        Page: '$page',
        Filter: { Condition: 'and', ConditionGroups: [{ Column: 'number', Operator: 'IN', Values: [] }] },
      })

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '50' } })
      fireEvent.blur(screen.getByLabelText('Limit'))
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ Limit: 50, Page: '$page' }))

      fireEvent.change(screen.getByLabelText('column'), { target: { value: 'label' } })
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ Page: '$page' }))

      fireEvent.change(screen.getByLabelText('Lookup table'), { target: { value: 'a-uuid' } })
      expect(onChange).toHaveBeenLastCalledWith({ LookupTable: 'a-uuid', Columns: [], Limit: 100, Page: '$page' })
    })

    it('shows nothing about the rows before the query has run', async () => {
      await renderEditor(paged)

      expect(screen.queryByLabelText('next page')).not.toBeInTheDocument()
    })

    it('shows nothing about the rows of a result from another tab', async () => {
      await renderEditor(paged, { fields: [], length: 10, meta: { custom: { resultType: 'trend' } } } as DataFrame)

      expect(screen.queryByLabelText('next page')).not.toBeInTheDocument()
    })

    it('shows where the rows sit and moves to the pages beside it', async () => {
      const onChange = await renderEditor({ ...paged, Page: 2 }, resultOf(100, 643, 2))

      expect(screen.getByText('Rows 101 to 200 of 643 (page 2 of 7)')).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText('next page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 3 })

      fireEvent.click(screen.getByLabelText('previous page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 1 })
    })

    // A click changes the query at once, while the result of the old page shows until the new run returns.
    it('moves from the page of the query while the result is of the page before', async () => {
      const onChange = await renderEditor(paged, resultOf(100, 643, 2))

      fireEvent.click(screen.getByLabelText('previous page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 2 })

      fireEvent.click(screen.getByLabelText('next page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 4 })
    })

    it('moves from the page a saved fraction runs as', async () => {
      const onChange = await renderEditor({ ...paged, Page: 2.5 }, resultOf(100, 643, 2))

      fireEvent.click(screen.getByLabelText('next page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 3 })

      fireEvent.click(screen.getByLabelText('previous page'))
      expect(onChange).toHaveBeenLastCalledWith({ ...paged, Page: 1 })
    })

    it('goes no further than the first and the last page', async () => {
      await renderEditor({ ...paged, Page: 1 }, resultOf(100, 100, 1))

      expect(screen.getByText('Rows 1 to 100 of 100 (page 1 of 1)')).toBeInTheDocument()
      expect(screen.getByLabelText('previous page')).toBeDisabled()
      expect(screen.getByLabelText('next page')).toBeDisabled()
    })

    // A page saved past the end, after rows were removed, steps back to the last one there is.
    it('steps back from past the last page to the last page', async () => {
      const onChange = await renderEditor({ ...paged, Page: 9 }, resultOf(0, 643, 9))

      expect(screen.getByText('No rows on page 9, the last page is 7 (643 rows)')).toBeInTheDocument()
      expect(screen.getByLabelText('next page')).toBeDisabled()

      fireEvent.click(screen.getByLabelText('previous page'))
      expect(onChange).toHaveBeenCalledWith({ ...paged, Page: 7 })
    })

    // The panel shows the page the variable resolved to, and moving it is the variable's job.
    it('shows the page a variable resolved to, without the buttons', async () => {
      await renderEditor({ ...paged, Page: '$page' }, resultOf(100, 643, 4))

      expect(screen.getByText('Rows 301 to 400 of 643 (page 4 of 7)')).toBeInTheDocument()
      expect(screen.getByLabelText('previous page')).toBeDisabled()
      expect(screen.getByLabelText('next page')).toBeDisabled()
    })

    // Until the next run returns, the last result describes the rows before the change.
    it('hides the rows of the last result when the table, the filter or the limit changes', async () => {
      const result = resultOf(100, 643, 3)
      const { rerender } = render(
        <LookupTables datasource={datasource} query={paged} result={result} onChangeLookupTableQuery={jest.fn()} />
      )
      await waitFor(() => expect(screen.getByLabelText('next page')).toBeInTheDocument())

      fireEvent.change(screen.getByLabelText('Limit'), { target: { value: '50' } })
      fireEvent.blur(screen.getByLabelText('Limit'))
      expect(screen.queryByLabelText('next page')).not.toBeInTheDocument()

      rerender(
        <LookupTables
          datasource={datasource}
          query={{ ...paged, Limit: 50, Page: undefined }}
          result={resultOf(50, 643, 1, 50)}
          onChangeLookupTableQuery={jest.fn()}
        />
      )
      expect(screen.getByText('Rows 1 to 50 of 643 (page 1 of 13)')).toBeInTheDocument()
    })

    it('counts the rows without a limit', async () => {
      await renderEditor({ LookupTable: 'a-uuid', Columns: [] }, resultOf(643, 643, 1, 0))

      expect(screen.getByText('643 rows')).toBeInTheDocument()
    })
  })
})
