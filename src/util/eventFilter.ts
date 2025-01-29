import { isFeatureEnabled } from './semver'

export type KnownOperator =
  | '='
  | '<'
  | '>'
  | '<='
  | '>='
  | '!='
  | 'IN'
  | 'NOT IN'
  | '~'
  | '!~'
  | 'IS NULL'
  | 'IS NOT NULL'
  | 'EXISTS'
  | 'NOT EXISTS'
export type KnownCondition = 'AND' | 'OR'

export const operatorsWithoutValue: KnownOperator[] = ['IS NULL', 'IS NOT NULL', 'EXISTS', 'NOT EXISTS']

const basicOperators: KnownOperator[] = ['=', '!=', '<', '<=', '>', '>=']
const v72Operators: KnownOperator[] = ['~', '!~', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'EXISTS', 'NOT EXISTS']

export function needsValue(operator: KnownOperator): boolean {
  return !operatorsWithoutValue.includes(operator)
}

export function getValueFilterOperatorsForVersion(version: string): KnownOperator[] {
  let operators = basicOperators
  if (version && isFeatureEnabled(version, 'v7.2.0', true)) {
    operators = operators.concat(v72Operators)
  }

  return operators
}
