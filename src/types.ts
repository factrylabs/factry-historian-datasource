import { DataQuery, DataSourceJsonData } from '@grafana/data';

/* eslint-disable no-use-before-define, @typescript-eslint/no-empty-interface */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attributes = Record<string, any>

export interface Query extends DataQuery {
  query: MeasurementQuery;
}

export const defaultQuery: Partial<Query> = {
};

/**
 * These are options configured for each DataSource instance.
 */
export interface HistorianDataSourceOptions extends DataSourceJsonData {
  url: string;
  username: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface HistorianSecureJsonData {
  token?: string;
  password?: string;
}

export interface MeasurementByName {
  Measurement: string
  Name: string
}


export interface Aggregation {
  Name: string
  Period?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Arguments?: any[]
  Fill?: string
}

export interface MeasurementQuery {
  MeasurementUUIDs?: string[]
  Measurements?: MeasurementByName[]
  Start: Date
  End?: Date
  Tags?: Attributes
  GroupBy?: string[]
  Limit?: number
  Offset?: number
  Aggregation?: Aggregation
  Desc?: boolean
  Join?: boolean
}
