import React from 'react'
import { SelectableValue } from '@grafana/data'
import { fireEvent, render, screen } from '@testing-library/react'
import { LookupTableFilterGroup } from './LookupTableFilterGroup'
import { LookupTableRowFilter } from 'types'

// Test doubles for the Grafana form controls, each keyed by the aria-label the component
// gives it, so a test drives the editor the way the form does: pick a column, pick an
// operator, type values.
jest.mock('@grafana/ui', () => ({
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
  // A select the user can type into is an input, the way the real one behaves with
  // allowCustomValue; one that only picks from a list is a select.
  Select: ({
    'aria-label': label,
    options,
    allowCustomValue,
    onChange,
  }: {
    'aria-label': string
    options: Array<SelectableValue<string>>
    allowCustomValue?: boolean
    onChange: (value: SelectableValue<string>) => void
  }) =>
    allowCustomValue ? (
      <input aria-label={label} onChange={(e) => onChange({ value: e.target.value })} />
    ) : (
      <select aria-label={label} onChange={(e) => onChange({ value: e.target.value })}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  // The values box takes free text, so the double is an input splitting on commas.
  MultiSelect: ({
    'aria-label': label,
    onChange,
  }: {
    'aria-label': string
    onChange: (values: Array<SelectableValue<string>>) => void
  }) => <input aria-label={label} onChange={(e) => onChange(e.target.value.split(',').map((value) => ({ value })))} />,
  useStyles2: () => ({ nested: 'nested' }),
}))

// The description carries the column's type, which is what the editor reads to decide whether
// the column can be ordered.
const columns: Array<SelectableValue<string>> = [
  { label: 'line', value: 'line', description: 'string' },
  { label: 'setpoint', value: 'setpoint', description: 'number' },
]

function renderGroup(filter: LookupTableRowFilter, onRemove?: () => void) {
  const onChange = jest.fn()
  render(
    <LookupTableFilterGroup
      label="Filters"
      filter={filter}
      columns={columns}
      templateVariables={[]}
      onChange={onChange}
      onRemove={onRemove}
    />
  )

  return onChange
}

const empty: LookupTableRowFilter = { Condition: 'and', ConditionGroups: [] }

describe('LookupTableFilterGroup', () => {
  it('adds a condition that starts out on the IN operator', () => {
    const onChange = renderGroup(empty)

    fireEvent.click(screen.getByText('Add condition'))

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: '', Operator: 'IN', Values: [] }],
    })
  })

  it('adds a nested group of its own', () => {
    const onChange = renderGroup(empty)

    fireEvent.click(screen.getByText('Add group'))

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Filter: { Condition: 'and', ConditionGroups: [] } }],
    })
  })

  // The condition joins one item to the one above it, so it is asked for once there is
  // something to join: a group of one condition narrows the same rows either way.
  it('combines the conditions with the condition picked between them', () => {
    const conditions: LookupTableRowFilter = {
      Condition: 'and',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Column: 'setpoint', Operator: 'IN', Values: ['4'] },
      ],
    }
    const onChange = renderGroup(conditions)

    fireEvent.change(screen.getByLabelText('condition'), { target: { value: 'or' } })

    expect(onChange).toHaveBeenCalledWith({ ...conditions, Condition: 'or' })
  })

  it('leaves the first condition of a group with nothing in front of it', () => {
    renderGroup({ Condition: 'and', ConditionGroups: [{ Column: 'line', Operator: 'IN', Values: ['L1'] }] })

    expect(screen.queryByLabelText('condition')).toBeNull()
  })

  // Every item of a group is joined by the same condition, so each box carries it and picking
  // in any of them sets it for the group.
  it('carries the group condition on every item after the first', () => {
    renderGroup({
      Condition: 'or',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Column: 'line', Operator: 'IN', Values: ['L2'] },
        { Column: 'line', Operator: 'IN', Values: ['L3'] },
      ],
    })

    expect(screen.getAllByLabelText('condition')).toHaveLength(2)
  })

  it('takes the column and the values of a condition', () => {
    const onChange = renderGroup({ Condition: 'and', ConditionGroups: [{ Column: '', Operator: 'IN', Values: [] }] })

    fireEvent.change(screen.getByLabelText('column'), { target: { value: 'line' } })
    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: 'IN', Values: [] }],
    })

    fireEvent.change(screen.getByLabelText('values'), { target: { value: 'L1,L2' } })
    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: '', Operator: 'IN', Values: ['L1', 'L2'] }],
    })
  })

  // A condition reading whether the cell is filled in takes no values, and must not keep an
  // empty list behind: an empty list is a condition matching no rows.
  it('drops the values of a condition switched to an empty cell operator', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IN', Values: ['42'] }],
    })

    fireEvent.change(screen.getByLabelText('operator'), { target: { value: 'IS NULL' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IS NULL', Values: undefined }],
    })
  })

  // An ordering is the wrong question to ask of a column that holds no numbers: it would match
  // no row whatever the value, so it is not offered at all.
  it('offers the orderings on a number column only', () => {
    renderGroup({
      Condition: 'and',
      ConditionGroups: [
        { Column: 'setpoint', Operator: 'IN', Values: [] },
        { Column: 'line', Operator: 'IN', Values: [] },
      ],
    })

    const options = (index: number) =>
      Array.from(screen.getAllByLabelText('operator')[index].querySelectorAll('option')).map((o) => o.value)

    expect(options(0)).toEqual(['=', '!=', '>', '>=', '<', '<=', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'])
    expect(options(1)).toEqual(['=', '!=', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL'])
  })

  // An equality holds the one value it compares against, so the editor asks for one the way it
  // does for an ordering, and it is offered on a column of any type.
  it('asks for a single value on an equality', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: '=', Values: [] }],
    })

    expect(screen.queryByLabelText('values')).toBeNull()
    fireEvent.change(screen.getByLabelText('value'), { target: { value: 'L1' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: '=', Values: ['L1'] }],
    })
  })

  // A condition switched from a set to an equality compares against one value, so the first of
  // the values already entered is the one it keeps.
  it('keeps the first value when a condition is switched to an equality', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: 'IN', Values: ['L1', 'L2'] }],
    })

    fireEvent.change(screen.getByLabelText('operator'), { target: { value: '=' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: '=', Values: ['L1'] }],
    })
  })

  // An ordering compares against one number, not a set of them, so the editor asks for one.
  it('asks for a single value on an ordering', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>', Values: ['21.5'] }],
    })

    expect(screen.queryByLabelText('values')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('value'), { target: { value: '30' } })
    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>', Values: ['30'] }],
    })
  })

  it('keeps the first value when a condition is switched to an ordering', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IN', Values: ['21.5', '30'] }],
    })

    fireEvent.change(screen.getByLabelText('operator'), { target: { value: '>=' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>=', Values: ['21.5'] }],
    })
  })

  // The orderings are offered on a number column only, so a condition moved off one cannot
  // keep the ordering it was on: the operator box would show nothing and the query would
  // carry a comparison no cell of the new column can satisfy.
  it('resets an ordering when its condition moves to a column that cannot be ordered', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>', Values: ['21.5'] }],
    })

    fireEvent.change(screen.getByLabelText('column'), { target: { value: 'line' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: 'IN', Values: ['21.5'] }],
    })
  })

  it('keeps the operator when its condition moves to a column that can be ordered', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>', Values: ['21.5'] }],
    })

    fireEvent.change(screen.getByLabelText('column'), { target: { value: 'setpoint' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: '>', Values: ['21.5'] }],
    })
  })

  it('shows no values box for a condition on an empty cell', () => {
    renderGroup({ Condition: 'and', ConditionGroups: [{ Column: 'setpoint', Operator: 'IS NULL' }] })

    expect(screen.queryByLabelText('values')).not.toBeInTheDocument()
    expect(screen.getByLabelText('operator')).toBeInTheDocument()
  })

  it('gives a condition switched back to IN an empty value list to fill', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IS NULL' }],
    })

    fireEvent.change(screen.getByLabelText('operator'), { target: { value: 'IN' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IN', Values: [] }],
    })
  })

  it('removes the condition asked for and leaves the rest', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Column: 'setpoint', Operator: 'IS NULL' },
      ],
    })

    fireEvent.click(screen.getAllByLabelText('remove condition')[0])

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'setpoint', Operator: 'IS NULL' }],
    })
  })

  // The nested group renders itself, so a change inside it has to come back out as a change
  // to the group holding it, with the rest of the tree untouched.
  it('carries a change inside a nested group back up the tree', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Filter: { Condition: 'or', ConditionGroups: [{ Column: 'setpoint', Operator: 'IN', Values: [] }] } },
      ],
    })

    // The second values box is the one in the nested group.
    fireEvent.change(screen.getAllByLabelText('values')[1], { target: { value: '42' } })

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Filter: { Condition: 'or', ConditionGroups: [{ Column: 'setpoint', Operator: 'IN', Values: ['42'] }] } },
      ],
    })
  })

  it('removes a nested group whole', () => {
    const onChange = renderGroup({
      Condition: 'and',
      ConditionGroups: [
        { Column: 'line', Operator: 'IN', Values: ['L1'] },
        { Filter: { Condition: 'or', ConditionGroups: [{ Column: 'setpoint', Operator: 'IS NULL' }] } },
      ],
    })

    fireEvent.click(screen.getByLabelText('remove group'))

    expect(onChange).toHaveBeenCalledWith({
      Condition: 'and',
      ConditionGroups: [{ Column: 'line', Operator: 'IN', Values: ['L1'] }],
    })
  })

  // The root group is the query's filter itself, so there is nothing to remove it from.
  it('offers no removal of the root group', () => {
    renderGroup(empty)

    expect(screen.queryByLabelText('remove group')).not.toBeInTheDocument()
  })
})
