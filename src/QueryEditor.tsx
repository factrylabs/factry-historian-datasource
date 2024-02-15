import React, { Component } from 'react'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { CoreApp, QueryEditorProps, SelectableValue } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { toSelectableValue } from 'components/TagsSection/util'
import { Assets } from 'QueryEditor/Assets'
import { Events } from 'QueryEditor/Events'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { Measurements } from 'QueryEditor/Measurements'
import { defaultQueryOptions, propertyFilterToQueryTags, sortByName, tagsToQueryTags } from 'QueryEditor/util'
import { DataSource } from './datasource'
import {
  HistorianDataSourceOptions,
  MeasurementQuery,
  Query,
  RawQuery,
  QueryEditorState,
  EventQuery,
  AssetMeasurementQuery,
  AssetMeasurementQueryState,
  TabIndex,
  Measurement,
  AggregationName,
  PropertyType,
} from './types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends Component<Props, QueryEditorState> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.onChangeAssetMeasurementQuery = this.onChangeAssetMeasurementQuery.bind(this)
    this.onChangeEventQuery = this.onChangeEventQuery.bind(this)
    this.saveState = this.saveState.bind(this)
  }

  appIsAlertingType = this.props.app === CoreApp.CloudAlerting || this.props.app === CoreApp.UnifiedAlerting
  state = {
    loading: true,
    tabIndex: this.props.datasource.defaultTab,
    filter: {
      Database: '',
    },
    pagination: {
      Limit: 100,
      Page: 1,
    },
    databases: [],
    assetProperties: [],
    assets: [],
    assetsState: {
      options: {
        query: {
          Assets: [],
          AssetProperties: [],
          Options: {
            Database: '',
            GroupBy: ['status'],
            Aggregation: {
              Name: AggregationName.Last,
              Period: '$__interval',
            },
            Tags: { status: 'Good' },
            IncludeLastKnownPoint: false,
            FillInitialEmptyValues: false,
            UseEngineeringSpecs: !this.appIsAlertingType,
            DisplayDatabaseName: false,
            DisplayDescription: false,
          },
        },
        tags: [{ key: 'status', value: 'Good' }],
      },
      selectedAsset: '',
      selectedProperties: [],
    },
    eventsState: {
      eventQuery: {
        Type: PropertyType.Simple,
        Statuses: [],
        PropertyFilter: [],
        EventTypes: [],
        Properties: [],
        QueryAssetProperties: false,
      },
      tags: [],
      selectedStatuses: [],
      selectedEventTypes: [],
      selectedProperties: [],
    },
    rawState: {
      rawQuery: {
        Query: '',
        TimeseriesDatabase: '',
      },
      filter: {
        Database: '',
      },
    },
    eventTypes: [],
    eventTypeProperties: [],
    eventConfigurations: [],
  } as QueryEditorState

  templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  async componentDidMount(): Promise<void> {
    const { query } = this.props
    const tabIndex = query.tabIndex ?? this.state.tabIndex

    this.setState((prevState) => {
      return {
        ...prevState,
        tabIndex: tabIndex,
        assetsState: {
          ...this.state.assetsState,
          selectedAsset: query.tabIndex === TabIndex.Assets ? query.selectedAssetPath : undefined,
        },
        eventsState: {
          ...this.state.eventsState,
          selectedAsset: query.tabIndex === TabIndex.Events ? query.selectedAssetPath : undefined,
        },
      }
    })

    await this.loadDataForTab(tabIndex)

    if (!query.query) {
      this.setState(
        (prevState) => {
          return {
            ...prevState,
            loading: false,
            tabIndex,
          }
        },
        () => {
          this.saveState(this.state)
        }
      )
    } else {
      switch (tabIndex) {
        case TabIndex.Assets: {
          const assetMeasurementQuery = query.query as AssetMeasurementQuery
          const queryOptions: AssetMeasurementQueryState = {
            tags: tagsToQueryTags(assetMeasurementQuery.Options.Tags),
            query: assetMeasurementQuery,
          }
          this.setState(
            (prevState) => {
              return {
                ...prevState,
                loading: false,
                tabIndex: tabIndex,
                assetsState: {
                  ...this.state.assetsState,
                  options: queryOptions,
                  selectedAsset: query.selectedAssetPath,
                  selectedProperties: assetMeasurementQuery.AssetProperties.map((e) => {
                    const prop = this.state.assetProperties.find(
                      (a) => a.Name === e && a.AssetUUID === query.selectedAssetPath
                    )
                    return { label: prop?.Name ?? e, value: prop?.UUID ?? e } as SelectableValue<string>
                  }),
                },
              }
            },
            () => {
              this.saveState(this.state)
            }
          )
          break
        }
        case TabIndex.Measurements: {
          this.setState(
            (prevState) => {
              return {
                ...prevState,
                loading: false,
                tabIndex: tabIndex,
              }
            },
            () => {
              this.saveState(this.state)
            }
          )
          break
        }
        case TabIndex.Events:
          const eventQuery = query.query as EventQuery
          this.setState(
            (prevState) => {
              return {
                ...prevState,
                loading: false,
                tabIndex: tabIndex,
                eventsState: {
                  ...this.state.eventsState,
                  eventQuery: eventQuery,
                  tags: propertyFilterToQueryTags(eventQuery.PropertyFilter ?? []),
                  selectedAsset: query.selectedAssetPath,
                  selectedStatuses: eventQuery.Statuses?.map((e) => toSelectableValue(e)),
                  selectedEventTypes: eventQuery.EventTypes
                    ? eventQuery.EventTypes.map((e) => {
                        return { label: this.state.eventTypes.find((et) => et.UUID === e)?.Name, value: e }
                      })
                    : undefined,
                },
              }
            },
            () => {
              this.saveState(this.state)
            }
          )
          break
        case TabIndex.RawQuery:
          const rawQuery = query.query as RawQuery
          this.setState(
            (prevState) => {
              return {
                ...prevState,
                loading: false,
                tabIndex: tabIndex,
                rawState: {
                  ...this.state.rawState,
                  filter: {
                    DatabaseUUIDs: [rawQuery.TimeseriesDatabase],
                  },
                  rawQuery: rawQuery,
                },
              }
            },
            () => {
              this.saveState(this.state)
            }
          )
          break
      }
    }
  }

  async loadDataForTab(tabIndex: number): Promise<void[]> {
    let promises = []
    switch (tabIndex || TabIndex.Assets) {
      case TabIndex.Assets:
        promises.push(this.getAssets())
        break
      case TabIndex.Measurements:
        promises.push(this.getTimeSeriesDatabases())
        break
      case TabIndex.Events:
        promises.push(this.getAssets())
        promises.push(this.getEventTypes())
        promises.push(this.getEventTypeProperties())
        promises.push(this.getEventConfigurations())
        break
      case TabIndex.RawQuery:
        promises.push(this.getTimeSeriesDatabases())
        break
    }

    return Promise.all(promises)
  }

  setTabIndex(index: number): void {
    this.setState(
      (prevState) => {
        return { ...prevState, tabIndex: index }
      },
      () => {
        this.saveState(this.state)
        this.loadDataForTab(index).then(() => {
          switch (index) {
            case TabIndex.Assets:
              if (this.state.assetsState.options.query) {
                this.onChangeAssetMeasurementQuery(this.state.assetsState.options.query)
              }
              break
            case TabIndex.Measurements:
              // TODO save queries in state to keep state when switching tabs
              this.onChangeMeasurementQuery(
                this.state.measurementQuery ?? {
                  Databases: [],
                  Measurements: [],
                  IsRegex: false,
                  Options: defaultQueryOptions(this.appIsAlertingType),
                }
              )
              break
            case TabIndex.RawQuery:
              if (this.state.rawState.rawQuery?.Query) {
                this.onChangeRawQuery(this.state.rawState.rawQuery.Query)
              }
              break
          }
        })
      }
    )
  }

  async getTimeSeriesDatabases(): Promise<void> {
    await this.props.datasource.getTimeseriesDatabases().then((timeSeriesDatabases) => {
      this.setState((prevState) => {
        return { ...prevState, databases: timeSeriesDatabases }
      })
    })
  }

  async getAssets(): Promise<void> {
    await this.props.datasource.getAssets().then(async (assets) => {
      const assetProperties = await this.props.datasource.getAssetProperties()
      let measurements: Measurement[] = []
      await Promise.all(
        assets.map(async (asset) => {
          let m = await this.props.datasource.getMeasurements({ AssetUUID: asset.UUID }, this.state.pagination)
          measurements = measurements.concat(m)
        })
      )

      this.setState((prevState) => {
        return {
          ...prevState,
          assetProperties: assetProperties.sort(sortByName),
          assets: assets,
          measurements: [...new Map(measurements.map((item) => [item.UUID, item])).values()],
        }
      })
    })
  }

  async getEventTypes(): Promise<void> {
    this.props.datasource.getEventTypes().then((eventTypes) => {
      this.setState((prevState) => {
        return { ...prevState, eventTypes: eventTypes }
      })
    })
  }

  async getEventTypeProperties(): Promise<void> {
    this.props.datasource.getEventTypeProperties().then((eventTypeProperties) => {
      this.setState((prevState) => {
        return { ...prevState, eventTypeProperties: eventTypeProperties }
      })
    })
  }

  async getEventConfigurations(): Promise<void> {
    this.props.datasource.getEventConfigurations().then((eventConfigurations) => {
      this.setState((prevState) => {
        return { ...prevState, eventConfigurations: eventConfigurations }
      })
    })
  }

  onChangeAssetMeasurementQuery(assetMeasurementQuery: AssetMeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'AssetMeasurementQuery'
    query.query = assetMeasurementQuery
    onChange(query)
    this.onRunQuery(this.props)
  }

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'MeasurementQuery'
    query.query = measurementQuery
    onChange(query)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      measurementQuery: measurementQuery,
    } as QueryEditorState)
  }

  onChangeRawQuery(queryString: string): void {
    const { onChange, query } = this.props
    query.queryType = 'RawQuery'
    query.query = {
      TimeseriesDatabase: this.state.rawState.filter.DatabaseUUIDs
        ? this.state.rawState.filter.DatabaseUUIDs[0]
        : undefined,
      Query: queryString,
    } as RawQuery
    this.saveState({
      ...this.state,
      rawState: {
        ...this.state.rawState,
        rawQuery: query.query,
      },
    })
    onChange(query)
    this.onRunQuery(this.props)
  }

  onChangeEventQuery(eventQuery: EventQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'EventQuery'
    query.query = eventQuery
    onChange(query)
    this.onRunQuery(this.props)
  }

  saveState(state: QueryEditorState, updateState = false): void {
    const { onChange, query } = this.props
    if (!query) {
      return
    }
    query.tabIndex = state.tabIndex
    switch (state.tabIndex) {
      case TabIndex.Assets:
        query.selectedAssetPath = state.assetsState.selectedAsset
        query.selectedAssetProperties = state.assetsState.selectedProperties.map((e) => e.value || '')
        break
      case TabIndex.Events:
        query.selectedAssetPath = state.eventsState.selectedAsset
        break
    }
    onChange(query)
    if (updateState) {
      this.setState(state)
    }
  }

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode
      }>
  ) {
    if (!props.query.queryType) {
      return
    }

    if (props.query.queryType === 'MeasurementQuery') {
      const query = props.query.query as MeasurementQuery
      if (query.IsRegex && !query.Regex) {
        return
      }
      if (!query?.Measurements) {
        return
      }
    }

    if (props.query.queryType === 'AssetMeasurementQuery') {
      const query = props.query.query as AssetMeasurementQuery
      if (!query.Assets || !query?.AssetProperties || query?.AssetProperties.length === 0) {
        return
      }
    }

    if (props.query.queryType === 'EventQuery') {
      const query = props.query.query as EventQuery
      if (!query?.EventTypes || !query?.Assets) {
        return
      }
    }

    this.props.onRunQuery()
  }

  render() {
    const tabs = [
      {
        title: 'Assets',
        content: (
          <Assets
            state={this.state}
            appIsAlertingType={this.appIsAlertingType}
            templateVariables={this.templateVariables}
            saveState={(state) => this.saveState(state, true)}
            onChangeAssetMeasurementQuery={this.onChangeAssetMeasurementQuery}
          />
        ),
      },
      {
        title: 'Measurements',
        content: this.props.query.query && (
          <Measurements
            query={this.props.query.query as MeasurementQuery}
            appIsAlertingType={this.appIsAlertingType}
            datasource={this.props.datasource}
            templateVariables={this.templateVariables}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
          />
        ),
      },
      {
        title: 'Events',
        content: (
          <Events
            datasource={this.props.datasource}
            state={this.state}
            appIsAlertingType={this.appIsAlertingType}
            saveState={(state) => this.saveState(state, true)}
            onChangeEventQuery={this.onChangeEventQuery}
          />
        ),
      },
      {
        title: 'Raw',
        content: (
          <RawQueryEditor
            state={this.state}
            saveState={(state) => this.saveState(state, true)}
            onChangeRawQuery={this.onChangeRawQuery}
          />
        ),
      },
    ]

    return (
      <>
        <InlineFieldRow>
          <InlineField>
            <RadioButtonGroup
              onChange={(e) => this.setTabIndex(e ?? 0)}
              value={this.state.tabIndex}
              options={tabs.map((tab, idx) => ({ label: tab.title, value: idx }))}
            />
          </InlineField>
        </InlineFieldRow>
        {!this.state.loading && tabs[this.state.tabIndex].content}
      </>
    )
  }
}
