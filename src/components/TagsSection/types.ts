export interface QueryTag {
  key: string
  operator?: string
  condition?: string
  value: string
}

export type KnownOperator = '=' | '<' | '>' | '<=' | '>=' | '!=' | 'IN' | 'NOT IN' | '~' | '!~' | 'IS NULL' | 'IS NOT NULL' | 'EXISTS' | 'NOT EXISTS'
export type KnownCondition = 'AND' | 'OR'
