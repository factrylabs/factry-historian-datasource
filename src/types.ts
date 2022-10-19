import { DataQuery, DataSourceJsonData } from '@grafana/data'

/* eslint-disable no-use-before-define, @typescript-eslint/no-empty-interface */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attributes = Record<string, any>

export interface Query extends DataQuery {
  query: MeasurementQuery | RawQuery;
}

export const defaultQuery: Partial<Query> = {
}

/**
 * These are options configured for each DataSource instance.
 */
export interface HistorianDataSourceOptions extends DataSourceJsonData {
  url: string
  username: string
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface HistorianSecureJsonData {
  token?: string
  password?: string
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
  Measurements?: any[]
  Tags?: Attributes
  GroupBy?: string[]
  Aggregation?: Aggregation
}

export interface MeasurementFilter {
  Keyword?: string
  Database?: string
  Collector?: string
  Asset?: string
  Statuses?: string[]
  WithBadQualityOnly?: boolean
  ExcludeCalculations?: boolean
}

export interface RawQuery {
  TimeseriesDatabase: string
  Query: string
}

export interface Collector {
  Name: string
  UUID: string
  Description: string
  CollectorType: string
}

export interface TimeseriesDatabase {
  Name: string
  UUID: string
  Description: string
}

export interface Measurement {
  Name: string
  UUID: string
  Description: string
  Datatype: string
  Status: string
  CollectorUUID: string
  Collector?: Collector
  DatabaseUUID: string
  Database: TimeseriesDatabase
  UoM: string
}

export interface Asset {
  Name: string
  UUID: string
  Description: string
  Status: string
  ParentUUID: string
  Parent?: Asset
}

export interface AssetProperty {
  Name: string
  UUID: string
  AssetUUID: string
  MeasurementUUID: string
}
