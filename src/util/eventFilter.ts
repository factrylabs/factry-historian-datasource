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

export const eventFilterOperators: KnownOperator[] = [
  '=',
  '!=',
  '<',
  '<=',
  '>',
  '>=',
  '~',
  '!~',
  'IN',
  'NOT IN',
  'IS NULL',
  'IS NOT NULL',
  'EXISTS',
  'NOT EXISTS',
]

export function needsValue(operator: KnownOperator): boolean {
  return !operatorsWithoutValue.includes(operator)
}
