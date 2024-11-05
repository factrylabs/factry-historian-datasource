export interface QueryTag {
  key: string
  operator?: string
  condition?: string
  value: string
}

export type KnownOperator = '=' | '<' | '>' | '<=' | '>=' | '!=' | 'IN' | 'NOT IN' | '~' | '!~'
export type KnownCondition = 'AND' | 'OR'
