import { DataSourceInstanceSettings } from '@grafana/data'
import { DataSourceWithBackend } from '@grafana/runtime'
import { Asset, AssetProperty, Collector, HistorianDataSourceOptions, Measurement, MeasurementFilter, Query, TimeseriesDatabase } from './types'

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<HistorianDataSourceOptions>) {
    super(instanceSettings)
  }

  async getMeasurements(filter: MeasurementFilter): Promise<Measurement[]> {
    return this.getResource('measurements', filter)
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
}
