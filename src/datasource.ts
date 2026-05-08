import { type AdHocVariableFilter, CoreApp, DataSourceInstanceSettings, dateTime, ScopedVars } from '@grafana/data'
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

  // Caching infrastructure
  private metadataCache = new Map<string, { data: unknown; timestamp: number; timeoutId: number }>()
  private cacheTTL = 5000 // 5 seconds
  private pendingRequests = new Map<string, Promise<unknown>>()

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

  private async cachedRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check cache
    const cached = this.metadataCache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T
    }

    // Deduplicate concurrent requests
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)! as Promise<T>
    }

    // Execute & cache
    const promise = fetcher()
    this.pendingRequests.set(key, promise)

    return promise
      .then((data) => {
        if (cached?.timeoutId) {
          clearTimeout(cached.timeoutId)
        }
        const timeoutId = setTimeout(() => this.metadataCache.delete(key), this.cacheTTL)
        this.metadataCache.set(key, { data, timestamp: Date.now(), timeoutId })
        this.pendingRequests.delete(key)
        return data
      })
      .catch((err) => {
        this.pendingRequests.delete(key)
        throw err
      })
  }

  getDefaultQuery(app: CoreApp): Partial<Query> {
    return {
      seriesLimit: 50,
    }
  }

  applyTemplateVariables(target: Query, scopedVars: ScopedVars, _filters?: AdHocVariableFilter[]): Query {
    const base: Query = {
      ...target,
      seriesLimit: this.templatedNumber(target.seriesLimit, 50, scopedVars),
    }
    const query = this.applyTemplateVariablesToQuery(base.queryType, base.query, scopedVars)
    return query !== null ? { ...base, query } : base
  }

  private applyTemplateVariablesToQuery(
    queryType: string | undefined,
    query: AssetMeasurementQuery | MeasurementQuery | RawQuery | EventQuery | undefined,
    scopedVars: ScopedVars
  ): AssetMeasurementQuery | MeasurementQuery | RawQuery | EventQuery | null {
    switch (queryType) {
      case 'AssetMeasurementQuery': {
        const q = JSON.parse(JSON.stringify(query)) as AssetMeasurementQuery
        q.Assets = q.Assets?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
        q.AssetProperties = q.AssetProperties.flatMap((e) => this.multiSelectReplace(e, scopedVars))
        q.Options = this.templateReplaceQueryOptions(q.Options, scopedVars)
        q.Options.ValueFilters = q.Options.ValueFilters?.filter((e) => e.Value !== 'enter a value')
        return q
      }
      case 'MeasurementQuery': {
        const q = JSON.parse(JSON.stringify(query)) as MeasurementQuery
        q.Databases = q.Databases?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
        q.Measurements = q.Measurements?.flatMap((m) => this.multiSelectReplace(m, scopedVars))
        if (q.IsRegex && q.Regex) {
          q.Regex = this.templateSrv.replace(q.Regex, scopedVars)
        }
        q.Options = this.templateReplaceQueryOptions(q.Options, scopedVars)
        q.Options.ValueFilters = q.Options.ValueFilters?.filter((e) => e.Value !== 'enter a value')
        return q
      }
      case 'RawQuery': {
        const q = JSON.parse(JSON.stringify(query)) as RawQuery
        q.TimeseriesDatabase = this.templateSrv.replace(q.TimeseriesDatabase, scopedVars)
        q.Query = this.templateSrv.replace(q.Query, scopedVars)
        return q
      }
      case 'EventQuery':
        return this.applyTemplateVariablesToEventQuery(query as EventQuery, scopedVars)
      default:
        return null
    }
  }

  private applyTemplateVariablesToEventQuery(query: EventQuery, scopedVars: ScopedVars): EventQuery {
    const eventQuery = JSON.parse(JSON.stringify(query)) as EventQuery
    eventQuery.Assets = eventQuery.Assets?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
    eventQuery.EventTypes = eventQuery.EventTypes?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
    eventQuery.Statuses = eventQuery.Statuses?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
    eventQuery.Properties = eventQuery.Properties?.flatMap((e) => this.multiSelectReplace(e, scopedVars)).map((e) =>
      e.replace('parent:', '')
    )
    eventQuery.PropertyFilter = this.replaceEventPropertyFilter(eventQuery.PropertyFilter, scopedVars)
    eventQuery.Limit = this.templatedNumber(eventQuery.Limit, 500, scopedVars)

    if (eventQuery.QueryAssetProperties) {
      eventQuery.OverrideAssets = eventQuery.OverrideAssets?.filter((e) => e !== '').flatMap((e) =>
        this.multiSelectReplace(e, scopedVars)
      )
      eventQuery.AssetProperties = eventQuery.AssetProperties?.flatMap((e) => this.multiSelectReplace(e, scopedVars))
      if (eventQuery.Options?.ValueFilters) {
        eventQuery.Options.ValueFilters = eventQuery.Options.ValueFilters.filter((e) => e.Value !== 'enter a value')
      }
    }

    if (!eventQuery.TimeRange || !eventQuery.OverrideTimeRange) {
      return eventQuery
    }

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
    return eventQuery
  }

  filterQuery(target: Query): boolean {
    return target.query !== undefined
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
    if (value === undefined) {
      return ['']
    }
    if (!this.containsTemplate(value)) {
      return [value]
    }
    // Use ASCII Unit Separator (U+001F) so commas inside resolved values are preserved.
    const SEP = '\x1F'
    const replaced = this.templateSrv.replace(value, scopedVars, (v: string | string[]) =>
      Array.isArray(v) ? v.join(SEP) : v
    )
    return replaced.split(SEP)
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
        Fill: this.templateSrv.replace(options.Aggregation.Fill, scopedVars),
        Arguments: aggregationArguments,
      }
    }
    options.Limit = this.templatedNumber(options.Limit, 0, scopedVars)
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
    return (
      typeof value === 'string' &&
      /\$\{?[_a-zA-Z][_a-zA-Z0-9]*(?::[a-zA-Z0-9_]+)?}?|\[\[[_a-zA-Z][_a-zA-Z0-9]*(?::[a-zA-Z0-9_]+)?\]\]/.test(value)
    )
  }

  async getInfo(): Promise<void> {
    const cacheKey = 'info'
    this.historianInfo = await this.cachedRequest(cacheKey, () => this.getResource('info'))
  }

  async getMeasurement(uuid: string): Promise<Measurement> {
    const cacheKey = `measurement:${uuid}`
    return this.cachedRequest(cacheKey, () => this.getResource(`measurements/${uuid}`))
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
    delete params.ScopedVars
    return this.cachedRequest(`measurements:${JSON.stringify(params)}`, () => this.getResource('measurements', params))
  }

  async getCollectors(): Promise<Collector[]> {
    const cacheKey = 'collectors'
    return this.cachedRequest(cacheKey, () => this.getResource('collectors'))
  }

  async getTimeseriesDatabases(filter?: TimeseriesDatabaseFilter): Promise<TimeseriesDatabase[]> {
    let params: Record<string, unknown> = {}
    if (filter) {
      if (filter.Keyword && isRegex(filter.Keyword) && !isValidRegex(filter.Keyword)) {
        return []
      }
      params = { ...filter }
      delete params.ScopedVars
    }
    const cacheKey = `databases:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource('databases', params))
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
      delete params.ScopedVars
    }
    const cacheKey = `assets:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource('assets', params))
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
      delete params.ScopedVars
    }
    const cacheKey = `assetProperties:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource('asset-properties', params))
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
      delete params.ScopedVars
    }
    const cacheKey = `eventTypes:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource('event-types', params))
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
      delete params.ScopedVars
    }
    const cacheKey = `eventTypeProperties:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource('event-type-properties', params))
  }

  async getEventConfigurations(): Promise<EventConfiguration[]> {
    const cacheKey = 'eventConfigurations'
    return this.cachedRequest(cacheKey, () => this.getResource('event-configurations'))
  }

  async getTagKeysForMeasurement(measurement: string): Promise<string[]> {
    const cacheKey = `tagKeys:${measurement}`
    return this.cachedRequest(cacheKey, () => this.getResource(`measurements/${measurement}/tags`))
  }

  async getTagKeysForMeasurements(filter: MeasurementFilter): Promise<string[]> {
    const f = this.templateReplaceMeasurementFilter(filter)
    if (f.Keyword && isRegex(f.Keyword) && !isValidRegex(f.Keyword)) {
      return Promise.resolve([])
    }
    const params: Record<string, unknown> = {
      ...f,
    }
    delete params.ScopedVars
    const cacheKey = `tagKeys:multi:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource(`tags`, params))
  }

  async getTagValuesForMeasurement(measurement: string, key: string): Promise<string[]> {
    const cacheKey = `tagValues:${measurement}:${key}`
    return this.cachedRequest(cacheKey, () => this.getResource(`measurements/${measurement}/tags/${key}`))
  }

  async getTagValuesForMeasurements(filter: MeasurementFilter, key: string): Promise<string[]> {
    const f = this.templateReplaceMeasurementFilter(filter)
    if (f.Keyword && isRegex(f.Keyword) && !isValidRegex(f.Keyword)) {
      return Promise.resolve([])
    }
    const params: Record<string, unknown> = {
      ...f,
    }
    delete params.ScopedVars
    const cacheKey = `tagValues:multi:${key}:${JSON.stringify(params)}`
    return this.cachedRequest(cacheKey, () => this.getResource(`tags/${key}`, params))
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
    return this.cachedRequest(`event-property-values:${JSON.stringify(params)}`, () =>
      this.getResource(`event-property-values/${filter.EventFilter.Properties![0]}`, params)
    )
  }

  // Replace template variables in the provided value and convert it to a number, of valid
  templatedNumber(raw: number | string | undefined, defaultValue: number, scopedVars?: ScopedVars): number {
    const replaced = typeof raw === 'string' ? Number(this.templateSrv.replace(raw, scopedVars)) : raw
    return typeof replaced === 'number' && !Number.isNaN(replaced) ? replaced : defaultValue
  }
}
