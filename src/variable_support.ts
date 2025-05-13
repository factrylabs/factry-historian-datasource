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
  EventTypePropertiesValuesFilter,
  EventTypeProperty,
  Measurement,
  MeasurementFilter,
  Pagination,
  PropertyDatatype,
  TimeseriesDatabase,
  TimeseriesDatabaseFilter,
  VariableQuery,
  VariableQueryType,
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
  getDistinctEventPropertyValues(filter: EventTypePropertiesValuesFilter): Promise<string[]>
  multiSelectReplace(value: string | undefined, scopedVars: ScopedVars): string[]
  replace(value: string | undefined, scopedVars: ScopedVars): string
}

export class VariableSupport extends CustomVariableSupport<DataSource> {
  constructor(private readonly dataAPI: DataAPI) {
    super()
    this.query = this.query.bind(this)
  }

  editor = VariableQueryEditor

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    const queryType = request.targets[0].type

    // If the query is not valid, return an empty array
    if ('valid' in request.targets[0] && !request.targets[0].valid) {
      return of({ data: [] })
    }

    switch (queryType) {
      case VariableQueryType.MeasurementQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as MeasurementFilter | undefined),
          ScopedVars: request.scopedVars,
        }

        if (!filter) {
          return of({ data: [] })
        }

        const pagination: Pagination = {
          Limit: 100,
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
      case VariableQueryType.AssetQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as AssetFilter | undefined),
          ScopedVars: request.scopedVars,
        }

        // Don't allow empty filter to not query too much data
        if (!filter) {
          return of({ data: [] })
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
      case VariableQueryType.EventTypeQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as EventTypeFilter | undefined),
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
        }
        return from(this.dataAPI.getEventTypes(filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case VariableQueryType.DatabaseQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as TimeseriesDatabaseFilter | undefined),
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
        }
        return from(this.dataAPI.getTimeseriesDatabases(filter)).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v.Name, value: v.UUID })) }
          })
        )
      }
      case VariableQueryType.EventTypePropertyQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as EventTypePropertiesFilter | undefined),
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
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
      case VariableQueryType.AssetPropertyQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as AssetPropertyFilter | undefined),
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
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
      case VariableQueryType.PropertyValuesQuery: {
        const filter = {
          ...(JSON.parse(JSON.stringify(request.targets[0].filter)) as EventTypePropertiesValuesFilter | undefined),
          ScopedVars: request.scopedVars,
        }
        if (!filter) {
          return of({ data: [] })
        }

        if (filter.EventFilter?.Assets) {
          filter.EventFilter.Assets = filter.EventFilter.Assets.flatMap((e) =>
            this.dataAPI.multiSelectReplace(e, request.scopedVars)
          )
        }
        if (filter.EventFilter?.EventTypes) {
          filter.EventFilter.EventTypes = filter.EventFilter.EventTypes.flatMap((e) =>
            this.dataAPI.multiSelectReplace(e, request.scopedVars)
          )
        }
        if (filter.EventFilter?.Properties) {
          filter.EventFilter.Properties = filter.EventFilter.Properties.flatMap((e) =>
            this.dataAPI.multiSelectReplace(e, request.scopedVars)
          )
        }
        if ((filter.EventFilter?.PropertyFilter.length ?? 0) > 0) {
          filter.EventFilter!.PropertyFilter = filter.EventFilter!.PropertyFilter?.map((e) => {
            e.Property = this.dataAPI.replace(e.Property, request.scopedVars)
            if (e.Operator === 'IN' || e.Operator === 'NOT IN') {
              const replacedValue = this.dataAPI.multiSelectReplace(String(e.Value), request.scopedVars)
              if (replacedValue.length === 0) {
                return e
              }
              e.Value = replacedValue
            } else {
              switch (e.Datatype) {
                case PropertyDatatype.Number:
                  e.Value = parseFloat(this.dataAPI.replace(String(e.Value), request.scopedVars))
                  break
                case PropertyDatatype.Bool:
                  e.Value = this.dataAPI.replace(String(e.Value), request.scopedVars) === 'true'
                  break
                case PropertyDatatype.String:
                  e.Value = this.dataAPI.replace(String(e.Value), request.scopedVars)
                  break
              }
            }

            return e
          })
        }

        return from(
          this.dataAPI.getDistinctEventPropertyValues({
            ScopedVars: request.scopedVars,
            EventFilter: filter.EventFilter!,
            HistorianInfo: filter.HistorianInfo,
            From: request.range.from.format(),
            To: request.range.to.format(),
          })
        ).pipe(
          map((values) => {
            return { data: values.map<MetricFindValue>((v) => ({ text: v, value: v })) }
          })
        )
      }
    }
  }
}
