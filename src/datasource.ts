import { CoreApp, DataQueryRequest, DataSourceInstanceSettings, dateTime, ScopedVars } from '@grafana/data'
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
  EventPropertyFilter,
  EventQuery,
  EventType,
  EventTypeFilter,
  EventTypePropertiesFilter,
  EventTypePropertiesValuesFilter,
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
import { isRegex, isValidRegex } from 'util/util'

export class DataSource extends DataSourceWithBackend<Query, HistorianDataSourceOptions> {
  defaultTab: TabIndex
  historianInfo: HistorianInfo | undefined
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
            const assetMeasurementQuery = JSON.parse(JSON.stringify(target.query)) as AssetMeasurementQuery
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
            assetMeasurementQuery.Options.ValueFilters = assetMeasurementQuery.Options.ValueFilters?.filter(
              (e) => e.Value !== 'enter a value'
            )
            target.query = assetMeasurementQuery
            break
          }
          case 'MeasurementQuery': {
            const measurementQuery = JSON.parse(JSON.stringify(target.query)) as MeasurementQuery
            measurementQuery.Databases = measurementQuery.Databases?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            measurementQuery.Measurements = measurementQuery.Measurements?.flatMap((m) =>
              this.multiSelectReplace(m, request.scopedVars)
            )
            if (measurementQuery.IsRegex && measurementQuery.Regex) {
              measurementQuery.Regex = this.templateSrv.replace(measurementQuery.Regex, request.scopedVars)
            }
            measurementQuery.Options = this.templateReplaceQueryOptions(measurementQuery.Options, request.scopedVars)
            measurementQuery.Options.ValueFilters = measurementQuery.Options.ValueFilters?.filter(
              (e) => e.Value !== 'enter a value'
            )
            target.query = measurementQuery
            break
          }
          case 'RawQuery': {
            const rawQuery = JSON.parse(JSON.stringify(target.query)) as RawQuery
            rawQuery.TimeseriesDatabase = this.templateSrv.replace(rawQuery.TimeseriesDatabase, request.scopedVars)
            rawQuery.Query = this.templateSrv.replace(rawQuery.Query, request.scopedVars)
            target.query = rawQuery
            break
          }
          case 'EventQuery': {
            const eventQuery = JSON.parse(JSON.stringify(target.query)) as EventQuery
            eventQuery.Assets = eventQuery.Assets?.flatMap((e) => this.multiSelectReplace(e, request.scopedVars))
            eventQuery.EventTypes = eventQuery.EventTypes?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            )
            eventQuery.Statuses = eventQuery.Statuses?.flatMap((e) => this.multiSelectReplace(e, request.scopedVars))
            eventQuery.Properties = eventQuery.Properties?.flatMap((e) =>
              this.multiSelectReplace(e, request.scopedVars)
            ).map((e) => e.replace('parent:', ''))
            if (eventQuery.QueryAssetProperties && eventQuery.Options?.ValueFilters) {
              eventQuery.OverrideAssets = eventQuery.OverrideAssets?.filter((e) => e !== '').flatMap((e) =>
                this.multiSelectReplace(e, request.scopedVars)
              )
              eventQuery.Options.ValueFilters = eventQuery.Options.ValueFilters.filter(
                (e) => e.Value !== 'enter a value'
              )
            }
            eventQuery.PropertyFilter = this.replaceEventPropertyFilter(eventQuery.PropertyFilter, request.scopedVars)

            // Time Range overrides
            if (eventQuery.TimeRange && eventQuery.OverrideTimeRange) {
              const resolvedFromTime = eventQuery.TimeRange.from ? this.replace(eventQuery.TimeRange.from) : null
              const timestampFrom = Number(resolvedFromTime)
              const parsedFromTime = eventQuery.TimeRange.from
                ? dateTime(isNaN(timestampFrom) ? resolvedFromTime : timestampFrom).toISOString()
                : null

              const resolvedToTime = eventQuery.TimeRange.to ? this.replace(eventQuery.TimeRange.to) : null
              const timestampTo = Number(resolvedToTime)
              const parsedToTime = eventQuery.TimeRange.to
                ? dateTime(isNaN(timestampTo) ? resolvedToTime : timestampTo).toISOString()
                : null

              eventQuery.TimeRange = {
                from: eventQuery.TimeRange.from,
                fromParsed: parsedFromTime,
                to: eventQuery.TimeRange.to,
                toParsed: parsedToTime,
              }
            }
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

  replaceEventPropertyFilter(
    eventPropertyFilter: EventPropertyFilter[],
    scopedVars: ScopedVars
  ): EventPropertyFilter[] {
    return (
      eventPropertyFilter
        ?.filter((e) => {
          if (
            e.Operator === 'IS NULL' ||
            e.Operator === 'IS NOT NULL' ||
            e.Operator === 'EXISTS' ||
            e.Operator === 'NOT EXISTS'
          ) {
            return true
          }

          if ((typeof e.Value === 'number' && isNaN(e.Value)) || (typeof e.Value === 'string' && e.Value === '')) {
            return false
          }

          return true
        })
        .map((e) => {
          e.Property = this.templateSrv.replace(e.Property, scopedVars)
          if (e.Operator === 'IN' || e.Operator === 'NOT IN') {
            const replacedValue = this.multiSelectReplace(String(e.Value), scopedVars)
            if (replacedValue.length === 0) {
              return e
            }
            e.Value = replacedValue
          } else {
            switch (e.Datatype) {
              case PropertyDatatype.Number:
                e.Value = parseFloat(this.templateSrv.replace(String(e.Value), scopedVars))
                break
              case PropertyDatatype.Bool:
                e.Value = this.templateSrv.replace(String(e.Value), scopedVars) === 'true'
                break
              case PropertyDatatype.String:
                e.Value = this.templateSrv.replace(String(e.Value), scopedVars)
                break
            }
            e.Value = [e.Value as string]
          }
          if (e.Parent) {
            e.Property = e.Property.replace('parent:', '')
          }
          return e
        }) ?? []
    )
  }

  // https://grafana.com/docs/grafana/latest/dashboards/variables/variable-syntax/
  multiSelectReplace(value: string | undefined, scopedVars?: ScopedVars): string[] {
    return this.templateSrv.replace(value, scopedVars, 'csv').split(',')
  }

  replace(value: string | undefined, scopedVars?: ScopedVars): string {
    return this.templateSrv.replace(value, scopedVars)
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
    if (options.ValueFilters) {
      options.ValueFilters = options.ValueFilters.map((e) => {
        e.Value = this.templateSrv.replace(String(e.Value), scopedVars)
        return e
      })
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

  containsTemplate(value: string): boolean {
    // Using our own custom function to check for template variables since the templateSrv.containsTemplate() function
    // does not seem to work with scenes in anything but the latest version of Grafana.
    return typeof value === 'string' && /\$\{?[_a-zA-Z][_a-zA-Z0-9]*(?::[a-zA-Z0-9_]+)?}?/.test(value)
  }

  async refreshInfo(): Promise<void> {
    this.historianInfo = await this.getResource('info')
  }

  async getMeasurement(uuid: string): Promise<Measurement> {
    return this.getResource(`measurements/${uuid}`)
  }

  async getMeasurements(filter: MeasurementFilter, pagination: Pagination): Promise<Measurement[]> {
    const f = this.templateReplaceMeasurementFilter(filter)
    if (f.Keyword && isRegex(f.Keyword) && !isValidRegex(f.Keyword)) {
      return Promise.resolve([])
    }

    const params: Record<string, unknown> = {
      ...f,
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
      if (filter.Keyword && isRegex(filter.Keyword) && !isValidRegex(filter.Keyword)) {
        return []
      }
      params = { ...filter }
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

      if (filter.Keyword && isRegex(filter.Keyword) && !isValidRegex(filter.Keyword)) {
        return []
      }
      if (filter.Path && isRegex(filter.Path) && !isValidRegex(filter.Path)) {
        return []
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
      if (filter.Keyword && isRegex(filter.Keyword) && !isValidRegex(filter.Keyword)) {
        return []
      }

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
    return this.getResource(`measurements/${measurement}/tags`)
  }

  async getTagKeysForMeasurements(filter: MeasurementFilter): Promise<string[]> {
    const f = this.templateReplaceMeasurementFilter(filter)
    if (f.Keyword && isRegex(f.Keyword) && !isValidRegex(f.Keyword)) {
      return Promise.resolve([])
    }
    const params: Record<string, unknown> = {
      ...f,
    }
    return this.getResource(`tags`, params)
  }

  async getTagValuesForMeasurement(measurement: string, key: string): Promise<string[]> {
    return this.getResource(`measurements/${measurement}/tags/${key}`)
  }

  async getTagValuesForMeasurements(filter: MeasurementFilter, key: string): Promise<string[]> {
    const f = this.templateReplaceMeasurementFilter(filter)
    if (f.Keyword && isRegex(f.Keyword) && !isValidRegex(f.Keyword)) {
      return Promise.resolve([])
    }
    const params: Record<string, unknown> = {
      ...f,
    }
    return this.getResource(`tags/${key}`, params)
  }

  async getDistinctEventPropertyValues(filter: EventTypePropertiesValuesFilter): Promise<string[]> {
    let params: Record<string, unknown> = {
      ...filter.EventFilter,
      ...filter.HistorianInfo,
      From:
        filter.EventFilter.OverrideTimeRange && filter.EventFilter.TimeRange.from
          ? dateTime(filter.EventFilter.TimeRange.from).toISOString()
          : filter.From,
      To:
        filter.EventFilter.OverrideTimeRange && filter.EventFilter.TimeRange.to
          ? dateTime(filter.EventFilter.TimeRange.to).toISOString()
          : filter.To,
    }

    delete params.PropertyFilter
    if (filter.EventFilter.PropertyFilter) {
      for (let i = 0; i < filter.EventFilter.PropertyFilter.length; i++) {
        params['PropertyFilter[' + i + '].Condition'] = filter.EventFilter.PropertyFilter[i].Condition
        params['PropertyFilter[' + i + '].Datatype'] = filter.EventFilter.PropertyFilter[i].Datatype
        params['PropertyFilter[' + i + '].Operator'] = filter.EventFilter.PropertyFilter[i].Operator
        params['PropertyFilter[' + i + '].Property'] = filter.EventFilter.PropertyFilter[i].Property.replace(
          'parent:',
          ''
        )
        params['PropertyFilter[' + i + '].Value'] = filter.EventFilter.PropertyFilter[i].Value
        params['PropertyFilter[' + i + '].Parent'] = filter.EventFilter.PropertyFilter[i].Parent
      }
    }
    if (!filter.EventFilter.Properties || filter.EventFilter.Properties.length === 0) {
      return Promise.resolve([])
    }

    return this.getResource(`event-property-values/${filter.EventFilter.Properties[0]}`, params)
  }
}
