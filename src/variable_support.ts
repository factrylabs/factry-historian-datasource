import { forkJoin, from, map, of, Observable } from 'rxjs'

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, MetricFindValue } from '@grafana/data'
import { TemplateSrv, getTemplateSrv } from '@grafana/runtime'
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
  multiSelectReplace(value: string | undefined): string[]
}

export class VariableSupport extends CustomVariableSupport<DataSource> {
  constructor(private readonly dataAPI: DataAPI, private readonly templateSrv: TemplateSrv = getTemplateSrv()) {
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
        }
        if (!filter) {
          return of({ data: [] })
        }

        const pagination: Pagination = {
          Limit: 0,
          Page: 0,
        }

        if (filter.DatabaseUUID) {
          filter.DatabaseUUID = this.templateSrv.replace(filter.DatabaseUUID)
        }

        return from(this.dataAPI.getMeasurements(filter, pagination)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case 'AssetQuery': {
        return from(this.dataAPI.getAssets(request.targets[0].filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.AssetPath ?? v.Name, value: v.UUID })) }
          })
        )
      }
      case 'EventTypeQuery': {
        return from(this.dataAPI.getEventTypes(request.targets[0].filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case 'DatabaseQuery': {
        return from(this.dataAPI.getTimeseriesDatabases(request.targets[0].filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case 'EventTypePropertyQuery': {
        return forkJoin({
          eventTypes: this.dataAPI.getEventTypes(),
          eventTypeProperties: this.dataAPI.getEventTypeProperties(request.targets[0].filter),
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
        }
        if (filter.AssetUUIDs) {
          filter.AssetUUIDs = filter.AssetUUIDs.flatMap((e) => this.dataAPI.multiSelectReplace(e))
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
