import { forkJoin, from, map, of, Observable } from 'rxjs';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, MetricFindValue } from "@grafana/data"
import { DataSource } from "datasource"
import { Asset, AssetProperty, Collector, EventConfiguration, EventType, EventTypeProperty, Measurement, MeasurementFilter, Pagination, TimeseriesDatabase, VariableQuery } from 'types'
import { VariableQueryEditor } from 'CustomVariableEditor/VariableEditor'

// https://github.com/storpool/grafana/blob/1f9efade078316fe502c72dba6156860d69928d4/public/app/plugins/datasource/grafana-pyroscope-datasource/VariableSupport.ts

export interface DataAPI {
  getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]>
  getCollectors(): Promise<Collector[]>
  getTimeseriesDatabases(): Promise<TimeseriesDatabase[]>
  getAssets(): Promise<Asset[]>
  getAssetProperties(): Promise<AssetProperty[]>
  getEventTypes(): Promise<EventType[]>
  getEventTypeProperties(): Promise<EventTypeProperty[]>
  getEventConfigurations(): Promise<EventConfiguration[]>
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
      case 'MeasurementQuery':
        const filter = request.targets[0].filter
        if (!filter) {
          return of({ data: [] })
        }

        const pagination: Pagination = {
          Limit: 0,
          Page: 0,
        }

        return from(this.dataAPI.getMeasurements(filter, pagination)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      case 'AssetQuery':
        return from(this.dataAPI.getAssets()).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.AssetPath ?? v.Name, value: v.UUID })) }
          })
        )
      case 'EventTypeQuery':
        return from(this.dataAPI.getEventTypes()).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      case 'DatabaseQuery':
        return from(this.dataAPI.getTimeseriesDatabases()).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      case 'EventTypePropertyQuery':
        return forkJoin({
          eventTypes: this.dataAPI.getEventTypes(),
          eventTypeProperties: this.dataAPI.getEventTypeProperties()
        }).pipe(
          map((values) => {
            return {
              data: values.eventTypeProperties.map<MetricFindValue>((eventTypeProperty) => {
                const eventType = values.eventTypes.find(e => e.UUID === eventTypeProperty.EventTypeUUID)
                let name = eventTypeProperty.Name
                if (eventType) {
                  name = `${eventType.Name} - ${name}`
                }
                return { text: name, value: eventTypeProperty.UUID }
              })
            }
          })
        )
      case 'AssetPropertyQuery':
        return forkJoin({
          assets: this.dataAPI.getAssets(),
          assetProperties: this.dataAPI.getAssetProperties()
        }).pipe(
          map((values) => {
            return {
              data: values.assetProperties.map<MetricFindValue>((assetProperty) => {
                const asset = values.assets.find(e => e.UUID === assetProperty.AssetUUID)
                let name = assetProperty.Name
                if (asset) {
                  name = `${asset.AssetPath ?? asset.Name} - ${name}`
                }
                return { text: name, value: assetProperty.UUID }
              })
            }
          })
        )
    }
    return of({ data: [] })
  }
}
