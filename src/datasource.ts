import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data'
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime'
import { Asset, AssetMeasurementQuery, AssetProperty, Collector, EventConfiguration, EventQuery, EventType, EventTypeProperty, HistorianDataSourceOptions, Measurement, MeasurementFilter, MeasurementQuery, Pagination, Query, RawQuery, TimeseriesDatabase } from './types'

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<HistorianDataSourceOptions>) {
    super(instanceSettings)
  }

  query(request: DataQueryRequest<Query>): any {
    for (let i = 0; i < request.targets.length; i++) {
      const query = request.targets[i]
      switch (query.queryType) {
        case 'AssetMeasurementQuery': {
          const assetMeasurementQuery = query.query as AssetMeasurementQuery
          assetMeasurementQuery.Asset = getTemplateSrv().replace(query.selectedAssetPath)
          assetMeasurementQuery.AssetProperties = assetMeasurementQuery.AssetProperties.map(e => getTemplateSrv().replace(e))
          assetMeasurementQuery.Options.GroupBy = assetMeasurementQuery.Options.GroupBy?.map(e => getTemplateSrv().replace(e))
          assetMeasurementQuery.Options.Aggregation = {
            Name: getTemplateSrv().replace(assetMeasurementQuery.Options.Aggregation?.Name),
            Period: getTemplateSrv().replace(assetMeasurementQuery.Options.Aggregation?.Period)
          }
          request.targets[i].query = assetMeasurementQuery
          break
        }
        case 'MeasurementQuery': {
          const measurementQuery = query.query as MeasurementQuery
          measurementQuery.Database = getTemplateSrv().replace(measurementQuery.Database)
          measurementQuery.Measurements = measurementQuery.Measurements?.map(e => getTemplateSrv().replace(e))
          measurementQuery.Options.GroupBy = measurementQuery.Options.GroupBy?.map(e => getTemplateSrv().replace(e))
          measurementQuery.Options.Aggregation = {
            Name: getTemplateSrv().replace(measurementQuery.Options.Aggregation?.Name),
            Period: getTemplateSrv().replace(measurementQuery.Options.Aggregation?.Period)
          }
          request.targets[i].query = measurementQuery
          break
        }
        case 'RawQuery': {
          const rawQuery = query.query as RawQuery
          rawQuery.Query = getTemplateSrv().replace(rawQuery.Query)
          request.targets[i].query = rawQuery
          break
        }
        case 'EventQuery': {
          const eventQuery = query.query as EventQuery
          eventQuery.Assets = eventQuery.Assets?.map(e => getTemplateSrv().replace(e))
          eventQuery.EventTypes = eventQuery.EventTypes?.map(e => getTemplateSrv().replace(e))
          request.targets[i].query = eventQuery
          break
        }
      }
    }
    return super.query(request)
  }

  async getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]> {
    const params: Record<string, unknown> = {
      ...filter,
    }
    if (pagination.Limit) {
      params["limit"] = pagination.Limit
    }
    if (pagination.Page) {
      params["page"] = pagination.Page
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
