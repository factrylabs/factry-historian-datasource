export interface QueryTag {
  key: string
  operator?: string
  condition?: string
  value: string
}

export type KnownOperator = '=' | '<' | '>' | '<=' | '>=' | '!='
export type KnownCondition = 'AND' | 'OR'
