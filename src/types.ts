import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data'
import type { CascaderOption } from 'components/Cascader/Cascader'

/* eslint-disable no-use-before-define, @typescript-eslint/no-empty-interface */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attributes = Record<string, any>

export interface State {
  tabIndex: number
  databases: TimeseriesDatabase[]
  pagination: Pagination
  measurements: Measurement[]
  assetProperties: AssetProperty[]
  assets: CascaderOption[]
  assetsState: AssetsTabState
  measurementsState: MeasurementsTabState
  rawState: RawTabState
}

export interface AssetsTabState {
  queryOptions: MeasurementQueryState
  selectedProperties: Array<SelectableValue<string>>
}

export interface MeasurementsTabState {
  queryOptions: MeasurementQueryState
  selectedMeasurement: SelectableValue<string>
}

export interface RawTabState {
  rawQuery: RawQuery
  filter: MeasurementFilter
}

export interface MeasurementQueryState {
  measurementQuery: MeasurementQuery
  filter: MeasurementFilter
  tags: any
}

export interface Query extends DataQuery {
  query: MeasurementQuery | RawQuery;
  state: State
}

export const defaultQuery: Partial<Query> = {
}

/**
 * These are options configured for each DataSource instance.
 */
export interface HistorianDataSourceOptions extends DataSourceJsonData {
  url: string
  organization: string
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface HistorianSecureJsonData {
  token?: string
}

export interface MeasurementByName {
  Measurement: string
  Name: string
}

export enum AggregationName {
  'count',
  'integral',
  'mean',
  'median',
  'mode',
  'spread',
  'stddev',
  'sum',
  'first',
  'last',
  'max',
  'min',
}

export interface Aggregation {
  Name: string
  Period?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Arguments?: any[]
  Fill?: string
}

export interface MeasurementQuery {
  Measurements?: string[]
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

export interface Pagination {
  Limit: number
  Page: number
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

export interface TimeseriesDatabaseType {
  Name: string
}

export interface TimeseriesDatabase {
  Name: string
  UUID: string
  Description: string
  TimeseriesDatabaseType?: TimeseriesDatabaseType
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
