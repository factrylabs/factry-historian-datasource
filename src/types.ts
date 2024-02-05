import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data'
import { QueryTag } from 'components/TagsSection/TagsSection'

export const labelWidth = 25
/* eslint-disable no-use-before-define, @typescript-eslint/no-empty-interface */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Attributes = Record<string, any>

export enum TabIndex {
  Assets,
  Measurements,
  Events,
  RawQuery,
}

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
  eventTypeProperties: EventTypeProperty[]
  eventConfigurations: EventConfiguration[]
}

export interface AssetsTabState {
  options: AssetMeasurementQueryState
  selectedAsset?: string
  selectedProperties: Array<SelectableValue<string>>
}

export interface MeasurementsTabState {
  options: MeasurementQueryState
  selectedMeasurements?: Array<SelectableValue<string>>
}

export interface RawTabState {
  rawQuery: RawQuery
  filter: MeasurementFilter
}

export interface EventsTabState {
  eventQuery: EventQuery
  selectedAsset?: string
  selectedEventTypes?: Array<SelectableValue<string>>
  selectedStatuses?: Array<SelectableValue<string>>
  tags: QueryTag[]
}

export interface MeasurementQueryState {
  query: MeasurementQuery
  filter: MeasurementFilter
  tags: QueryTag[]
}

export interface AssetMeasurementQueryState {
  query: AssetMeasurementQuery
  tags: QueryTag[]
}

export interface Query extends DataQuery {
  query: MeasurementQuery | AssetMeasurementQuery | RawQuery | EventQuery
  tabIndex: number
  selectedMeasurement?: string // kept for backwards compatibility
  selectedMeasurements?: string[]
  selectedAssetPath?: string
  selectedAssetProperties?: string[]
}

export const defaultQuery: Partial<Query> = {}

/**
 * These are options configured for each DataSource instance.
 */
export interface HistorianDataSourceOptions extends DataSourceJsonData {
  url: string
  organization: string
  defaultTab?: TabIndex
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
  Count = 'count',
  Integral = 'integral',
  Mean = 'mean',
  Median = 'median',
  Mode = 'mode',
  Spread = 'spread',
  StdDev = 'stddev',
  Sum = 'sum',
  First = 'first',
  Last = 'last',
  Max = 'max',
  Min = 'min',
}

export enum FillType {
  None = 'none',
  Null = 'null',
  Previous = 'previous',
  Linear = 'linear',
  Zero = '0',
}

export interface Aggregation {
  Name: string
  Period?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Arguments?: any[]
  Fill?: string
}

export interface MeasurementQueryOptions {
  Tags?: Attributes
  GroupBy?: string[]
  Aggregation?: Aggregation
  IncludeLastKnownPoint: boolean
  FillInitialEmptyValues: boolean
  UseEngineeringSpecs: boolean
  DisplayDatabaseName: boolean
  DisplayDescription: boolean
  Limit?: number
}

export interface MeasurementQuery {
  Database: string
  Measurement?: string // kept for backwards compatibility
  Measurements?: string[]
  Options: MeasurementQueryOptions
}

export interface AssetMeasurementQuery {
  Assets: string[]
  AssetProperties: string[]
  Options: MeasurementQueryOptions
}

export interface EventQuery {
  Assets?: string[]
  EventTypes?: string[]
  Statuses?: string[]
  PropertyFilter: EventPropertyFilter[]
}

export interface MeasurementFilter {
  Keyword?: string
  DatabaseUUID?: string
  CollectorUUID?: string
  AssetUUID?: string
  Statuses?: string[]
  WithBadQualityOnly?: boolean
  ExcludeCalculations?: boolean
}

export interface EventPropertyFilter {
  Property: string
  Datatype: string
  Value: string | number | boolean
  Operator: string
  Condition: string
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
  ParentUUID?: string
  Parent?: Asset
  AssetPath?: string
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

export enum PropertyDatatype {
  Number = 'number',
  Bool = 'boolean',
  String = 'string',
}

export interface EventTypeProperty {
  Name: string
  UUID: string
  EventTypeUUID: string
  Datatype: PropertyDatatype
}

export interface EventConfiguration {
  Name: string
  UUID: string
  AssetUUID: string
  EventTypeUUID: string
}

export type MeasurementVariableQuery = {
  refId: string
  type: 'MeasurementQuery'
  filter?: MeasurementFilter
  pagination?: Pagination
}

export type AssetVariableQuery = {
  refId: string
  type: 'AssetQuery'
}

export type EventTypeVariableQuery = {
  refId: string
  type: 'EventTypeQuery'
}

export type DatabaseVariableQuery = {
  refId: string
  type: 'DatabaseQuery'
}

export type EventTypePropertyVariableQuery = {
  refId: string
  type: 'EventTypePropertyQuery'
}

export type AssetPropertyVariableQuery = {
  refId: string
  type: 'AssetPropertyQuery'
}

export type VariableQuery = MeasurementVariableQuery | AssetVariableQuery | EventTypeVariableQuery | DatabaseVariableQuery | EventTypePropertyVariableQuery | AssetPropertyVariableQuery
