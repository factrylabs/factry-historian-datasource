import { DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { HistorianDataSourceOptions, Query } from './types';

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<HistorianDataSourceOptions>) {
    super(instanceSettings);
  }

  async getMeasurements(keyspace: string): Promise<any[]> {
    return this.getResource('measurements', {});
  }
}
