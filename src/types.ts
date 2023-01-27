import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data'
import { QueryTag } from 'TagsSection'

/* eslint-disable no-use-before-define, @typescript-eslint/no-empty-interface */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attributes = Record<string, any>

export interface QueryEditorState {
  loading: boolean
  tabIndex: number
  databases: TimeseriesDatabase[]
  pagination: Pagination
  measurements: Measurement[]
  assetProperties: AssetProperty[]
  assets: Asset[]
  assetsState: AssetsTabState
  measurementsState: MeasurementsTabState
  eventsState: EventsTabState
  rawState: RawTabState
  eventTypes: EventType[]
  eventConfigurations: EventConfiguration[]
}

export interface AssetsTabState {
  queryOptions: MeasurementQueryState
  selectedAsset?: string
  selectedProperties: Array<SelectableValue<string>>
}

export interface MeasurementsTabState {
  queryOptions: MeasurementQueryState
  selectedMeasurement?: string
}

export interface RawTabState {
  rawQuery: RawQuery
  filter: MeasurementFilter
}

export interface EventsTabState {
  eventQuery: EventQuery
  selectedAsset?: string
  selectedEventTypes?: Array<SelectableValue<string>>
}

export interface MeasurementQueryState {
  measurementQuery: MeasurementQuery
  filter: MeasurementFilter
  tags: QueryTag[]
}

export interface Query extends DataQuery {
  query: MeasurementQuery | RawQuery | EventQuery
  tabIndex: number
  selectedMeasurement?: string
  selectedAssetPath?: string
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
  IncludeLastKnownPoint: boolean
}

export interface EventQuery {
  Assets?: string[]
  EventTypes?: string[]
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

export interface EventType {
  Name: string
  UUID: string
  Description: string
}

export interface EventConfiguration {
  Name: string
  UUID: string
  AssetUUID: string
  EventTypeUUID: string
}
