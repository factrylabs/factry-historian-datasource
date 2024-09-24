import { CoreApp, DataQueryRequest, DataSourceInstanceSettings, ScopedVars } from '@grafana/data'
import { DataSourceWithBackend, TemplateSrv, getTemplateSrv } from '@grafana/runtime'
import { VariableSupport } from 'variable_support'
import { AnnotationsQueryEditor } from 'AnnotationsQueryEditor/AnnotationsQueryEditor'
import {
  Asset,
  AssetFilter,
  AssetMeasurementQuery,
  AssetProperty,
  AssetPropertyFilter,
  Attributes,
  Collector,
  EventConfiguration,
  EventQuery,
  EventType,
  EventTypeFilter,
  EventTypePropertiesFilter,
  EventTypeProperty,
  HistorianDataSourceOptions,
  HistorianInfo,
  Measurement,
  MeasurementFilter,
  MeasurementQuery,
  MeasurementQueryOptions,
  Pagination,
  PropertyDatatype,
  Query,
  RawQuery,
  TabIndex,
  TimeseriesDatabase,
  TimeseriesDatabaseFilter,
} from './types'

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  defaultTab: TabIndex
  constructor(
    instanceSettings: DataSourceInstanceSettings<HistorianDataSourceOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings)
    this.defaultTab = instanceSettings.jsonData.defaultTab ?? TabIndex.Assets
    this.variables = new VariableSupport(this)
    this.annotations = {
      QueryEditor: AnnotationsQueryEditor,
    }
  }

  filterQuery(query: Query): boolean {
    switch (query.queryType) {
      case 'EventQuery':
        const eventQuery = query.query as EventQuery
        if (eventQuery.PropertyFilter?.find((e) => e.Value === 'select tag value')) {
          return false
        }
    }
    return true
  }

  getDefaultQuery(app: CoreApp): Partial<Query> {
    return {
      seriesLimit: 50,
    }
  }

  query(request: DataQueryRequest<Query>): any {
    request.targets = request.targets
      .filter((target) => {
        return !target.hide && target.query !== undefined
      })
      .map((target) => {
        if (!target.seriesLimit) {
          target.seriesLimit = 50
        }

        switch (target.queryType) {
          case 'AssetMeasurementQuery': {
            const assetMeasurementQuery = target.query as AssetMeasurementQuery
            assetMeasurementQuery.Assets = assetMeasurementQuery.Assets?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            assetMeasurementQuery.AssetProperties = assetMeasurementQuery.AssetProperties.flatMap((e) => {
              return this.multiSelectReplace(e, request.scopedVars)
            })
            assetMeasurementQuery.Options = this.templateReplaceQueryOptions(
              assetMeasurementQuery.Options,
              request.scopedVars
            )
            target.query = assetMeasurementQuery
            break
          }
          case 'MeasurementQuery': {
            const measurementQuery = target.query as MeasurementQuery
            measurementQuery.Databases = measurementQuery.Databases?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            measurementQuery.Measurements = measurementQuery.Measurements?.flatMap((m) =>
              this.multiSelectReplace(m, request.scopedVars)
            )
            measurementQuery.Options = this.templateReplaceQueryOptions(measurementQuery.Options, request.scopedVars)
            target.query = measurementQuery
            break
          }
          case 'RawQuery': {
            const rawQuery = target.query as RawQuery
            rawQuery.TimeseriesDatabase = this.templateSrv.replace(rawQuery.TimeseriesDatabase, request.scopedVars)
            rawQuery.Query = this.templateSrv.replace(rawQuery.Query, request.scopedVars)
            target.query = rawQuery
            break
          }
          case 'EventQuery': {
            const eventQuery = target.query as EventQuery
            eventQuery.Assets = eventQuery.Assets?.flatMap((e) => this.multiSelectReplace(e, request.scopedVars))
            eventQuery.EventTypes = eventQuery.EventTypes?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            eventQuery.Statuses = eventQuery.Statuses?.flatMap((e) => this.multiSelectReplace(e, request.scopedVars))
            eventQuery.Properties = eventQuery.Properties?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            eventQuery.PropertyFilter = eventQuery.PropertyFilter?.map((e) => {
              e.Property = this.templateSrv.replace(e.Property, request.scopedVars)
              if (e.Value === 'select tag value') {
                return e
              }

              switch (e.Datatype) {
                case PropertyDatatype.Number:
                  e.Value = parseFloat(this.templateSrv.replace(String(e.Value), request.scopedVars))
                  break
                case PropertyDatatype.Bool:
                  e.Value = this.templateSrv.replace(String(e.Value), request.scopedVars) === 'true'
                  break
                case PropertyDatatype.String:
                  e.Value = this.templateSrv.replace(String(e.Value), request.scopedVars)
                  break
              }
              return e
            })
            target.query = eventQuery
            break
          }
          default:
            break
        }
        return target
      })
    return super.query(request)
  }

  // https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/
  multiSelectReplace(value: string | undefined, scopedVars?: ScopedVars): string[] {
    return this.templateSrv.replace(value, scopedVars, 'csv').split(',')
  }

  templateReplaceQueryOptions(options: MeasurementQueryOptions, scopedVars: ScopedVars): MeasurementQueryOptions {
    if (options.GroupBy) {
      options.GroupBy = options.GroupBy?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
    }
    if (options.Tags) {
      const tags: Attributes = {}
      for (const [key, value] of Object.entries(options.Tags)) {
        tags[this.templateSrv.replace(key, scopedVars)] = this.templateSrv.replace(value, scopedVars)
      }
      options.Tags = tags
    }
    if (options.Aggregation) {
      const aggregationArguments = options.Aggregation.Arguments
      if (aggregationArguments) {
        for (let i = 0; i < aggregationArguments.length; i++) {
          aggregationArguments[i] = this.templateSrv.replace(aggregationArguments[i], scopedVars)
        }
      }
      options.Aggregation = {
        Name: this.templateSrv.replace(options.Aggregation?.Name, scopedVars),
        Period: this.templateSrv.replace(options.Aggregation?.Period, scopedVars),
        Fill: options.Aggregation.Fill,
        Arguments: aggregationArguments,
      }
    }
    return options
  }

  templateReplaceMeasurementFilter(filter: MeasurementFilter): MeasurementFilter {
    filter.DatabaseUUIDs = filter.DatabaseUUIDs?.flatMap((e) => this.multiSelectReplace(e, filter.ScopedVars))
    filter.Keyword = this.templateSrv.replace(filter.Keyword, filter.ScopedVars)
    return filter
  }

  async getInfo(): Promise<HistorianInfo> {
    return this.getResource('info')
  }

  async getMeasurement(uuid: string): Promise<Measurement> {
    return this.getResource(`measurements/${uuid}`)
  }

  async getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]> {
    const params: Record<string, unknown> = {
      ...this.templateReplaceMeasurementFilter(filter),
    }
    if (pagination.Limit) {
      params['limit'] = pagination.Limit
    }
    if (pagination.Page) {
      params['page'] = pagination.Page
    }
    return this.getResource('measurements', params)
  }

  async getCollectors(): Promise<Collector[]> {
    return this.getResource('collectors')
  }

  async getTimeseriesDatabases(filter?: TimeseriesDatabaseFilter): Promise<TimeseriesDatabase[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      params = {
        ...filter,
      }
    }
    return this.getResource('databases', params)
  }

  async getAssets(filter?: AssetFilter): Promise<Asset[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      params = {
        ...filter,
      }
      if (filter.ParentUUIDs) {
        const parentUUIDs = filter.ParentUUIDs.flatMap((e) => this.multiSelectReplace(e, filter.ScopedVars))
        if (parentUUIDs.some((e) => e === '')) {
          // empty string means there is no parent selected
          return []
        }
        params.ParentUUIDs = parentUUIDs
      }

      if (filter.Keyword) {
        params.Keyword = this.templateSrv.replace(filter.Keyword, filter.ScopedVars)
      }
    }
    return this.getResource('assets', params)
  }

  async getAssetProperties(filter?: AssetPropertyFilter): Promise<AssetProperty[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      params = {
        ...filter,
      }
      if (filter.AssetUUIDs) {
        params.AssetUUIDs = filter.AssetUUIDs.flatMap((e) => this.multiSelectReplace(e, filter.ScopedVars))
      }
    }
    return this.getResource('asset-properties', params)
  }

  async getEventTypes(filter?: EventTypeFilter): Promise<EventType[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      params = {
        ...filter,
      }
    }
    return this.getResource('event-types', params)
  }

  async getEventTypeProperties(filter?: EventTypePropertiesFilter): Promise<EventTypeProperty[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      const eventTypePropertiesFilter: EventTypePropertiesFilter = {
        ...filter,
      }
      if (eventTypePropertiesFilter.EventTypeUUIDs) {
        eventTypePropertiesFilter.EventTypeUUIDs = eventTypePropertiesFilter.EventTypeUUIDs.flatMap((e) =>
          this.multiSelectReplace(e, filter.ScopedVars)
        )
      }
      params = {
        ...eventTypePropertiesFilter,
      }
    }
    return this.getResource('event-type-properties', params)
  }

  async getEventConfigurations(): Promise<EventConfiguration[]> {
    return this.getResource('event-configurations')
  }

  async getTagKeysForMeasurement(measurement: string): Promise<string[]> {
    return this.getResource(`tag-keys/${measurement}`)
  }

  async getTagKeysForMeasurements(filter: MeasurementFilter): Promise<string[]> {
    const params: Record<string, unknown> = {
      ...this.templateReplaceMeasurementFilter(filter),
    }
    return this.getResource(`tag-keys`, params)
  }

  async getTagValuesForMeasurement(measurement: string, key: string): Promise<string[]> {
    return this.getResource(`tag-values/${measurement}/${key}`)
  }

  async getTagValuesForMeasurements(filter: MeasurementFilter, key: string): Promise<string[]> {
    const params: Record<string, unknown> = {
      ...this.templateReplaceMeasurementFilter(filter),
    }
    return this.getResource(`tag-values/${key}`, params)
  }
}
