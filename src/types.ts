import { DataSourceJsonData, ScopedVars } from '@grafana/data'
import { DataQuery } from '@grafana/schema'

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
  tabIndex: number
  measurementQuery: MeasurementQuery
  assetMeasurementQuery: AssetMeasurementQuery
  eventQuery: EventQuery
  rawQuery: RawQuery
}

export interface Query extends DataQuery {
  query: MeasurementQuery | AssetMeasurementQuery | RawQuery | EventQuery
  seriesLimit: number
  tabIndex: number
  selectedAssetPath?: string
  selectedAssetProperties?: string[]
  historianInfo?: HistorianInfo
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
  MetadataAsLabels: boolean
  Limit?: number
  ValueFilters?: ValueFilter[]
}

export interface ValueFilter {
  Value: string | number | boolean
  Operator: '=' | '!=' | '>' | '<' | '>=' | '<='
  Condition: 'AND' | 'OR' | ''
}

export interface MeasurementQuery {
  Databases?: string[]
  IsRegex: boolean
  Regex?: string
  Measurements?: string[]
  Options: MeasurementQueryOptions
}

export interface AssetMeasurementQuery {
  Assets: string[]
  AssetProperties: string[]
  Options: MeasurementQueryOptions
}

export interface EventQuery {
  Type: string
  Assets: string[]
  EventTypes?: string[]
  Statuses?: string[]
  Properties?: string[]
  PropertyFilter: EventPropertyFilter[]
  QueryAssetProperties: boolean
  AssetProperties?: string[]
  Options?: MeasurementQueryOptions
}

export enum EventTypePropertyType {
  Simple = 'simple',
  Periodic = 'periodic',
}

export interface ResourceFilter {
  ScopedVars?: ScopedVars
}

export interface MeasurementFilter extends ResourceFilter {
  Keyword?: string
  DatabaseUUIDs?: string[]
  CollectorUUID?: string
  AssetUUID?: string
  Statuses?: string[]
}

export interface AssetFilter extends ResourceFilter {
  Keyword?: string
  Path?: string
  ParentUUIDs?: string[]
  UseAssetPath?: boolean
}

export interface AssetPropertyFilter extends ResourceFilter {
  AssetUUIDs?: string[]
  Recursive?: boolean
}

export interface TimeseriesDatabaseFilter extends ResourceFilter {
  Keyword?: string
}

export interface EventTypeFilter extends ResourceFilter {
  Keyword?: string
}

export interface EventTypePropertiesFilter extends ResourceFilter {
  EventTypeUUIDs?: string[]
  Types?: string[]
}

export interface EventTypePropertiesValuesFilter extends ResourceFilter {
  EventFilter: EventQuery
  EventTypePropertyUUID?: string
  HistorianInfo?: HistorianInfo
  From?: string
  To?: string
}

export interface EventPropertyFilter extends ResourceFilter {
  Property: string
  Datatype: string
  Value?: string | number | boolean | string[]
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
  Database?: TimeseriesDatabase
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

export enum PropertyType {
  Simple = 'simple',
  Periodic = 'periodic',
}

export interface EventTypeProperty {
  Name: string
  UUID: string
  EventTypeUUID: string
  Datatype: PropertyDatatype
  Type: PropertyType
}

export interface EventConfiguration {
  Name: string
  UUID: string
  AssetUUID: string
  EventTypeUUID: string
}

export enum VariableQueryType {
  MeasurementQuery = 'MeasurementQuery',
  AssetQuery = 'AssetQuery',
  EventTypeQuery = 'EventTypeQuery',
  DatabaseQuery = 'DatabaseQuery',
  EventTypePropertyQuery = 'EventTypePropertyQuery',
  AssetPropertyQuery = 'AssetPropertyQuery',
  PropertyValuesQuery = 'PropertyValuesQuery',
}

export type MeasurementVariableQuery = {
  refId: string
  type: VariableQueryType.MeasurementQuery
  filter?: MeasurementFilter
  valid: boolean
  pagination?: Pagination
}

export type AssetVariableQuery = {
  refId: string
  type: VariableQueryType.AssetQuery
  filter?: AssetFilter
  valid: boolean
}

export type EventTypeVariableQuery = {
  refId: string
  type: VariableQueryType.EventTypeQuery
  filter?: EventTypeFilter
  valid: boolean
}

export type DatabaseVariableQuery = {
  refId: string
  type: VariableQueryType.DatabaseQuery
  filter?: TimeseriesDatabaseFilter
  valid: boolean
}

export type EventTypePropertyVariableQuery = {
  refId: string
  type: VariableQueryType.EventTypePropertyQuery
  filter?: EventTypePropertiesFilter
}

export type AssetPropertyVariableQuery = {
  refId: string
  type: VariableQueryType.AssetPropertyQuery
  filter?: AssetPropertyFilter
}

export type PropertyValuesVariableQuery = {
  refId: string
  type: VariableQueryType.PropertyValuesQuery
  filter?: EventTypePropertiesValuesFilter
}

export type VariableQuery =
  | MeasurementVariableQuery
  | AssetVariableQuery
  | EventTypeVariableQuery
  | DatabaseVariableQuery
  | EventTypePropertyVariableQuery
  | AssetPropertyVariableQuery
  | PropertyValuesVariableQuery

export interface HistorianInfo {
  Version: string
  APIVersion: string
}
