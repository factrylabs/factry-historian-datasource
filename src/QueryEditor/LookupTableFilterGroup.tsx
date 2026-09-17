import React from 'react'
import { css } from '@emotion/css'
import { GrafanaTheme2, SelectableValue } from '@grafana/data'
import {
  Button,
  IconButton,
  InlineField,
  InlineFieldRow,
  MultiSelect,
  RadioButtonGroup,
  Select,
  useStyles2,
} from '@grafana/ui'
import {
  labelWidth,
  LookupTableRowCondition,
  LookupTableRowConditionGroup,
  LookupTableRowFilter,
  LookupTableRowOperator,
} from 'types'
import { selectable } from './util'

/** The operators every column can be compared with, whatever its cells hold. */
const operators: Array<SelectableValue<LookupTableRowOperator>> = [
  { label: 'IN', value: 'IN' },
  { label: 'NOT IN', value: 'NOT IN' },
  { label: 'IS NULL', value: 'IS NULL' },
  { label: 'IS NOT NULL', value: 'IS NOT NULL' },
]

/**
 * The orderings, which only a number column is offered: they compare the cell as a number, so
 * on a column holding anything else they would match no row at all.
 */
const comparisons: Array<SelectableValue<LookupTableRowOperator>> = [
  { label: '>', value: '>' },
  { label: '>=', value: '>=' },
  { label: '<', value: '<' },
  { label: '<=', value: '<=' },
]

/** The operators reading whether the cell is filled in, which compare against no value. */
const valuelessOperators: LookupTableRowOperator[] = ['IS NULL', 'IS NOT NULL']

/** The orderings, which compare against a single value rather than a set of them. */
const singleValueOperators: LookupTableRowOperator[] = ['>', '>=', '<', '<=']

/** Renders one entered value as the option a select shows it as. */
function selectableValue(value: string | number | boolean | null): SelectableValue<string> {
  return { label: String(value), value: String(value) }
}

const conditions: Array<SelectableValue<LookupTableRowCondition>> = [
  { label: 'AND', value: 'and' },
  { label: 'OR', value: 'or' },
]

/** The empty group a new nesting level starts as. */
export const emptyLookupTableFilter: LookupTableRowFilter = { Condition: 'and', ConditionGroups: [] }

export interface Props {
  filter: LookupTableRowFilter
  columns: Array<SelectableValue<string>>
  templateVariables: Array<SelectableValue<string>>
  onChange(filter: LookupTableRowFilter): void
  /** Absent on the root group, which is part of the query rather than something to remove. */
  onRemove?(): void
  /** The label the first row carries, so only the root group is labelled in the form. */
  label?: string
}

/**
 * One group of a lookup table row filter: the conditions it holds, the operator combining
 * them, and the groups nested inside it. It renders itself for every nested group, so the
 * editor goes as deep as the filter does.
 */
export const LookupTableFilterGroup = (props: Props): JSX.Element => {
  const styles = useStyles2(getStyles)
  const groups = props.filter.ConditionGroups

  const replaceGroup = (index: number, group: LookupTableRowConditionGroup | undefined): void => {
    const next = [...groups]
    if (group === undefined) {
      next.splice(index, 1)
    } else {
      next[index] = group
    }

    props.onChange({ ...props.filter, ConditionGroups: next })
  }

  const addGroup = (group: LookupTableRowConditionGroup): void => {
    props.onChange({ ...props.filter, ConditionGroups: [...groups, group] })
  }

  // The operators reading whether the cell is filled in carry no values at all: an empty list
  // is a condition matching no rows under IN, which is not what they mean. An ordering compares
  // against one value, so switching to one keeps the first of the values already entered.
  const changeOperator = (
    index: number,
    group: LookupTableRowConditionGroup,
    operator: LookupTableRowOperator
  ): void => {
    let values = group.Values ?? []
    if (singleValueOperators.includes(operator)) {
      values = values.slice(0, 1)
    }

    replaceGroup(index, {
      ...group,
      Operator: operator,
      Values: valuelessOperators.includes(operator) ? undefined : values,
    })
  }

  // A column holding numbers can be ordered as well as matched, and the options follow the
  // column, so an ordering is never put on a column whose cells could not satisfy it.
  const operatorsFor = (column?: string): Array<SelectableValue<LookupTableRowOperator>> => {
    const type = props.columns.find((e) => e.value === column)?.description
    return type === 'number' ? [...operators, ...comparisons] : operators
  }

  // The options follow the column, so moving a condition to a column that cannot be ordered
  // would leave an ordering behind that the operator box no longer holds: it would show
  // nothing while the query still carried the ordering, which matches no row on a column
  // holding no numbers. The condition falls back to the IN it starts on, keeping the values
  // already entered.
  const changeColumn = (index: number, group: LookupTableRowConditionGroup, column: string): void => {
    const operator = group.Operator ?? 'IN'
    if (operatorsFor(column).some((e) => e.value === operator)) {
      replaceGroup(index, { ...group, Column: column })
      return
    }

    replaceGroup(index, { ...group, Column: column, Operator: 'IN', Values: group.Values ?? [] })
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={props.label}
          labelWidth={props.label ? labelWidth : undefined}
          tooltip={
            props.label
              ? 'Keeps the rows matching the conditions. Group conditions to combine AND and OR in one filter.'
              : undefined
          }
        >
          <RadioButtonGroup
            aria-label="match"
            options={conditions}
            value={props.filter.Condition}
            onChange={(condition) => props.onChange({ ...props.filter, Condition: condition })}
          />
        </InlineField>
        <InlineField>
          <Button variant="secondary" icon="plus" onClick={() => addGroup({ Column: '', Operator: 'IN', Values: [] })}>
            Add condition
          </Button>
        </InlineField>
        <InlineField>
          <Button variant="secondary" icon="plus" onClick={() => addGroup({ Filter: emptyLookupTableFilter })}>
            Add group
          </Button>
        </InlineField>
        {props.onRemove && (
          <InlineField className={styles.remove}>
            <IconButton name="trash-alt" aria-label="remove group" onClick={props.onRemove} />
          </InlineField>
        )}
      </InlineFieldRow>
      <div className={props.label ? styles.aligned : styles.children}>
        {groups.map((group, index) =>
          group.Filter ? (
            <div key={index} className={styles.nested}>
              <LookupTableFilterGroup
                filter={group.Filter}
                columns={props.columns}
                templateVariables={props.templateVariables}
                onChange={(filter) => replaceGroup(index, { Filter: filter })}
                onRemove={() => replaceGroup(index, undefined)}
              />
            </div>
          ) : (
            <InlineFieldRow key={index}>
              <InlineField>
                <Select
                  aria-label="column"
                  value={selectable(props.columns, group.Column ?? '')}
                  placeholder="select column"
                  options={props.columns}
                  onChange={(event) => changeColumn(index, group, event.value ?? '')}
                />
              </InlineField>
              <InlineField>
                <Select<LookupTableRowOperator>
                  aria-label="operator"
                  value={operatorsFor(group.Column).find((operator) => operator.value === (group.Operator ?? 'IN'))}
                  options={operatorsFor(group.Column)}
                  onChange={(event) => changeOperator(index, group, event.value ?? 'IN')}
                />
              </InlineField>
              {singleValueOperators.includes(group.Operator ?? 'IN') && (
                <InlineField grow>
                  <Select
                    aria-label="value"
                    // A value entered by hand is no option of its own, so it has to be handed
                    // back as one for the box to show what it holds.
                    value={group.Values?.length ? selectableValue(group.Values[0]) : undefined}
                    placeholder="enter a value"
                    options={props.templateVariables}
                    allowCustomValue
                    onChange={(event) => replaceGroup(index, { ...group, Values: [event.value ?? ''] })}
                  />
                </InlineField>
              )}
              {!singleValueOperators.includes(group.Operator ?? 'IN') &&
                !valuelessOperators.includes(group.Operator ?? 'IN') && (
                  <InlineField grow>
                    <MultiSelect
                      aria-label="values"
                      value={(group.Values ?? []).map((value) => String(value))}
                      placeholder="enter values"
                      options={props.templateVariables}
                      allowCustomValue
                      onChange={(events) => replaceGroup(index, { ...group, Values: events.map((e) => e.value ?? '') })}
                    />
                  </InlineField>
                )}
              <InlineField className={styles.remove}>
                <IconButton
                  name="trash-alt"
                  aria-label="remove condition"
                  onClick={() => replaceGroup(index, undefined)}
                />
              </InlineField>
            </InlineFieldRow>
          )
        )}
      </div>
    </>
  )
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // The conditions of the root group line up with the value column of the form, where every
    // other field's input sits: an inline label is 8 pixels per width unit, plus the gap the
    // row puts after it.
    aligned: css({
      marginLeft: `${labelWidth * 8 + 4}px`,
    }),
    children: css({
      marginLeft: theme.spacing(1),
    }),
    // The icon is half the height of the controls it sits beside, and a row aligns its
    // contents to the top, so it needs centring to land on the same line as them.
    remove: css({
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
    }),
    // The rule runs alongside a nested group from its own operator down through everything it
    // holds, which is what makes it read as one group rather than as loose rows.
    nested: css({
      paddingLeft: theme.spacing(1),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
  }
}
