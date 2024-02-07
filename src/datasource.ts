import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data'
import { DataSourceWithBackend, TemplateSrv, getTemplateSrv } from '@grafana/runtime'
import { VariableSupport } from 'variable_support'
import {
  Asset,
  AssetMeasurementQuery,
  AssetProperty,
  Attributes,
  Collector,
  EventConfiguration,
  EventQuery,
  EventType,
  EventTypeProperty,
  HistorianDataSourceOptions,
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
  }

  query(request: DataQueryRequest<Query>): any {
    request.targets = request.targets
      .filter((target) => !target.hide)
      .map((target) => {
        switch (target.queryType) {
          case 'AssetMeasurementQuery': {
            const assetMeasurementQuery = target.query as AssetMeasurementQuery
            assetMeasurementQuery.Assets = assetMeasurementQuery.Assets?.flatMap((e) => this.multiSelectReplace(e))
            assetMeasurementQuery.AssetProperties = assetMeasurementQuery.AssetProperties.flatMap((e) => {
              return this.multiSelectReplace(e)
            })
            assetMeasurementQuery.Options = this.templateReplaceQueryOptions(assetMeasurementQuery.Options)
            target.query = assetMeasurementQuery
            break
          }
          case 'MeasurementQuery': {
            const measurementQuery = target.query as MeasurementQuery
            measurementQuery.Database = this.templateSrv.replace(measurementQuery.Database)
            measurementQuery.Measurement = measurementQuery.Measurement
              ? this.templateSrv.replace(measurementQuery.Measurement)
              : undefined
            measurementQuery.Measurements = measurementQuery.Measurements?.flatMap((m) => this.multiSelectReplace(m))
            measurementQuery.Options = this.templateReplaceQueryOptions(measurementQuery.Options)
            target.query = measurementQuery
            break
          }
          case 'RawQuery': {
            const rawQuery = target.query as RawQuery
            rawQuery.TimeseriesDatabase = this.templateSrv.replace(rawQuery.TimeseriesDatabase)
            rawQuery.Query = this.templateSrv.replace(rawQuery.Query)
            target.query = rawQuery
            break
          }
          case 'EventQuery': {
            const eventQuery = target.query as EventQuery
            eventQuery.Assets = eventQuery.Assets?.flatMap((e) => this.multiSelectReplace(e))
            eventQuery.EventTypes = eventQuery.EventTypes?.flatMap((e) => this.multiSelectReplace(e))
            eventQuery.Statuses = eventQuery.Statuses?.flatMap((e) => this.multiSelectReplace(e))
            eventQuery.PropertyFilter = eventQuery.PropertyFilter.map((e) => {
              e.Property = this.templateSrv.replace(e.Property)
              switch (e.Datatype) {
                case PropertyDatatype.Number:
                  e.Value = parseFloat(this.templateSrv.replace(String(e.Value)))
                  break
                case PropertyDatatype.Bool:
                  e.Value = this.templateSrv.replace(String(e.Value)) === 'true'
                  break
                case PropertyDatatype.String:
                  e.Value = this.templateSrv.replace(String(e.Value))
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
  multiSelectReplace(value: string | undefined): string[] {
    return this.templateSrv.replace(value, undefined, 'csv').split(',')
  }

  templateReplaceQueryOptions(options: MeasurementQueryOptions): MeasurementQueryOptions {
    if (options.GroupBy) {
      options.GroupBy = options.GroupBy?.flatMap((e) => this.multiSelectReplace(e))
    }
    if (options.Tags) {
      const tags: Attributes = {}
      for (const [key, value] of Object.entries(options.Tags)) {
        tags[this.templateSrv.replace(key)] = this.templateSrv.replace(value)
      }
      options.Tags = tags
    }
    if (options.Aggregation) {
      const aggregationArguments = options.Aggregation.Arguments
      if (aggregationArguments) {
        for (let i = 0; i < aggregationArguments.length; i++) {
          aggregationArguments[i] = this.templateSrv.replace(aggregationArguments[i])
        }
      }
      options.Aggregation = {
        Name: this.templateSrv.replace(options.Aggregation?.Name),
        Period: this.templateSrv.replace(options.Aggregation?.Period),
        Fill: options.Aggregation.Fill,
        Arguments: aggregationArguments,
      }
    }
    return options
  }

  async getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]> {
    const params: Record<string, unknown> = {
      ...filter,
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

  async getTimeseriesDatabases(): Promise<TimeseriesDatabase[]> {
    return this.getResource('databases')
  }

  async getAssets(): Promise<Asset[]> {
    return this.getResource('assets')
  }

  async getAssetProperties(): Promise<AssetProperty[]> {
    return this.getResource('asset-properties')
  }

  async getEventTypes(): Promise<EventType[]> {
    return this.getResource('event-types')
  }

  async getEventTypeProperties(): Promise<EventTypeProperty[]> {
    return this.getResource('event-type-properties')
  }

  async getEventConfigurations(): Promise<EventConfiguration[]> {
    return this.getResource('event-configurations')
  }
}
