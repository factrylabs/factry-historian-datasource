import { forkJoin, from, map, of, Observable } from 'rxjs'

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, MetricFindValue, ScopedVars } from '@grafana/data'
import { DataSource } from 'datasource'
import { VariableQueryEditor } from 'CustomVariableEditor/VariableEditor'
import {
  Asset,
  AssetFilter,
  AssetProperty,
  AssetPropertyFilter,
  Collector,
  EventConfiguration,
  EventType,
  EventTypeFilter,
  EventTypePropertiesFilter,
  EventTypeProperty,
  Measurement,
  MeasurementFilter,
  Pagination,
  TimeseriesDatabase,
  TimeseriesDatabaseFilter,
  VariableQuery,
} from 'types'

// https://github.com/storpool/grafana/blob/1f9efade078316fe502c72dba6156860d69928d4/public/app/plugins/datasource/grafana-pyroscope-datasource/VariableSupport.ts

export interface DataAPI {
  getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]>
  getCollectors(): Promise<Collector[]>
  getTimeseriesDatabases(filter?: TimeseriesDatabaseFilter): Promise<TimeseriesDatabase[]>
  getAssets(filter?: AssetFilter): Promise<Asset[]>
  getAssetProperties(filter?: AssetPropertyFilter): Promise<AssetProperty[]>
  getEventTypes(filter?: EventTypeFilter): Promise<EventType[]>
  getEventTypeProperties(filter?: EventTypePropertiesFilter): Promise<EventTypeProperty[]>
  getEventConfigurations(): Promise<EventConfiguration[]>
  multiSelectReplace(value: string | undefined, scopedVars: ScopedVars): string[]
}

export class VariableSupport extends CustomVariableSupport<DataSource> {
  constructor(private readonly dataAPI: DataAPI) {
    super()
    this.query = this.query.bind(this)
  }

  editor = VariableQueryEditor

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    const queryType = request.targets[0].type
    switch (queryType) {
      case 'MeasurementQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
        }

        const pagination: Pagination = {
          Limit: 0,
          Page: 0,
        }

        if (filter.DatabaseUUIDs) {
          filter.DatabaseUUIDs = filter.DatabaseUUIDs?.flatMap((e) =>
            this.dataAPI.multiSelectReplace(e, request.scopedVars)
          )
        }

        return forkJoin({
          measurements: this.dataAPI.getMeasurements(filter, pagination),
          databases: this.dataAPI.getTimeseriesDatabases(),
        }).pipe(
          map((values) => {
            return {
              data: values.measurements.map<MetricFindValue>((measurement) => {
                const database = values.databases.find((e) => e.UUID === measurement.DatabaseUUID)
                let name = measurement.Name
                if (database) {
                  name = `${measurement.Name} - ${database.Name}`
                }
                return { text: name, value: measurement.UUID }
              }),
            }
          })
        )
      }
      case 'AssetQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }
        const useAssetPath = filter.UseAssetPath ?? false
        return from(this.dataAPI.getAssets(filter)).pipe(
          map((values) => {
            return {
              data: values.map<MetricFindValue>((v) => ({
                text: useAssetPath ? v.AssetPath ?? v.Name : v.Name,
                value: v.UUID,
              })),
            }
          })
        )
      }
      case 'EventTypeQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }

        return from(this.dataAPI.getEventTypes(filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case 'DatabaseQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }

        return from(this.dataAPI.getTimeseriesDatabases(filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case 'EventTypePropertyQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }

        return forkJoin({
          eventTypes: this.dataAPI.getEventTypes(),
          eventTypeProperties: this.dataAPI.getEventTypeProperties(filter),
        }).pipe(
          map((values) => {
            return {
              data: values.eventTypeProperties.map<MetricFindValue>((eventTypeProperty) => {
                const eventType = values.eventTypes.find((e) => e.UUID === eventTypeProperty.EventTypeUUID)
                let name = eventTypeProperty.Name
                if (eventType) {
                  name = `${eventType.Name} - ${name}`
                }
                return { text: name, value: eventTypeProperty.UUID }
              }),
            }
          })
        )
      }
      case 'AssetPropertyQuery': {
        const filter = {
          ...request.targets[0].filter,
          ScopedVars: request.scopedVars,
        }
        if (filter.AssetUUIDs) {
          filter.AssetUUIDs = filter.AssetUUIDs.flatMap((e) => this.dataAPI.multiSelectReplace(e, request.scopedVars))
        }
        return from(this.dataAPI.getAssetProperties(filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.Name })) }
          })
        )
      }
    }
    return of({ data: [] })
  }
}
