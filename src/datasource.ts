import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { HistorianDataSourceOptions, MeasurementFilter, Query } from './types';

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<HistorianDataSourceOptions>) {
    super(instanceSettings);
  }

  async getMeasurements(filter: MeasurementFilter): Promise<any[]> {
    return this.getResource('measurements', filter);
  }

  async getCollectors(): Promise<any[]> {
    return this.getResource('collectors')
  }

  async getTimeseriesDatabases(): Promise<any[]> {
    return this.getResource('databases')
  }

  async getAssets(): Promise<any[]> {
    return this.getResource('assets')
  }
}
