import React, { Component } from 'react'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { CoreApp, QueryEditorProps, SelectableValue } from '@grafana/data'
import { toSelectableValue } from 'components/TagsSection/util'
import { Assets } from 'QueryEditor/Assets'
import { Measurements } from 'QueryEditor/Measurements'
import { Events } from 'QueryEditor/Events'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { measurementToSelectableValue, propertyFilterToQueryTags, sortByName, tagsToQueryTags } from 'QueryEditor/util'
import { DataSource } from './datasource'
import {
  HistorianDataSourceOptions,
  MeasurementQuery,
  Query,
  RawQuery,
  QueryEditorState,
  MeasurementQueryState,
  EventQuery,
  AssetMeasurementQuery,
  AssetMeasurementQueryState,
  TabIndex,
  Measurement,
  AggregationName,
} from './types'
import { getTemplateSrv } from '@grafana/runtime'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends Component<Props, QueryEditorState> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.loadMeasurementOptions = this.loadMeasurementOptions.bind(this)
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
    measurements: [],
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
            IncludeLastKnownPoint: false,
            FillInitialEmptyValues: false,
            UseEngineeringSpecs: !this.appIsAlertingType,
            DisplayDatabaseName: false,
            DisplayDescription: false,
          },
        },
        tags: [],
      },
      selectedAsset: '',
      selectedProperties: [],
    },
    measurementsState: {
      options: {
        query: {
          Database: '',
          Options: {
            GroupBy: ['status'],
            Aggregation: {
              Name: AggregationName.Last,
              Period: '$__interval',
            },
            IncludeLastKnownPoint: false,
            FillInitialEmptyValues: false,
            UseEngineeringSpecs: !this.appIsAlertingType,
            DisplayDatabaseName: false,
            DisplayDescription: false,
          },
        },
        filter: {
          Database: '',
        },
        tags: [],
      },
      selectedMeasurements: [],
    },
    eventsState: {
      eventQuery: {
        Statuses: [],
        PropertyFilter: [],
      },
      tags: [],
      selectedStatuses: [],
      selectedEventTypes: [],
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

  async componentDidMount(): Promise<void> {
    const { query } = this.props
    const tabIndex = query.tabIndex ?? this.state.tabIndex
    let selectedMeasurements = query.selectedMeasurements ?? []
    if (query.selectedMeasurement) {
      selectedMeasurements = [...selectedMeasurements, query.selectedMeasurement]
    }
    const measurements = await this.loadMultipleMeasurementOptions(selectedMeasurements)
    const allMeasurements = await this.loadMeasurementOptions('')

    this.setState((prevState) => {
      return {
        ...prevState,
        tabIndex: tabIndex,
        measurementsState: {
          ...this.state.measurementsState,
          selectedMeasurements: measurements,
          selectedMeasurement: undefined,
        },
        measurements: allMeasurements,
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
          const measurementQuery = query.query as MeasurementQuery
          const queryOptions: MeasurementQueryState = {
            tags: tagsToQueryTags(measurementQuery.Options.Tags),
            filter: {
              DatabaseUUID: measurementQuery.Database,
            },
            query: measurementQuery,
          }
          this.setState(
            (prevState) => {
              return {
                ...prevState,
                loading: false,
                tabIndex: tabIndex,
                measurementsState: {
                  ...this.state.measurementsState,
                  options: queryOptions,
                  selectedMeasurements: measurements,
                },
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
                    DatabaseUUID: rawQuery.TimeseriesDatabase,
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
              if (this.state.measurementsState.options.query) {
                this.onChangeMeasurementQuery(this.state.measurementsState.options.query)
              }
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

  async loadMeasurementOptions(query: string): Promise<Measurement[]> {
    const filter = { ...this.state.measurementsState.options.filter, Keyword: query }

    const measurements = await this.props.datasource.getMeasurements(filter, this.state.pagination)

    measurements.forEach((measurement) => {
      const database = this.state.databases.find((e) => e.UUID === measurement.DatabaseUUID)
      if (database) {
        measurement.Database = database
      }
    })

    return measurements
  }

  async loadMultipleMeasurementOptions(items: string[]): Promise<Array<SelectableValue<string>>> {
    const result: Array<SelectableValue<string>> = []
    let measurementsFound: Measurement[] = []
    for (const item of items) {
      if (getTemplateSrv().containsTemplate(item)) {
        result.push({
          label: item,
          value: item,
        })
        continue
      }

      const filter = { ...this.state.measurementsState.options.filter, Keyword: item }
      const measurements = await this.props.datasource.getMeasurements(filter, this.state.pagination)
      measurementsFound = [...measurementsFound, ...measurements]
      // if more than 1 measurement it is probably a regex
      if (measurements.length > 1) {
        result.push({
          label: item,
          value: item,
        })
      } else {
        measurements.forEach((measurement) => {
          if (!measurement.Database) {
            const database = this.state.databases.find((e) => e.UUID === measurement.DatabaseUUID)
            if (database) {
              measurement.Database = database
            }
          }
          result.push(measurementToSelectableValue(measurement))
        })
      }
    }
    return result
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
  }

  onChangeRawQuery(queryString: string): void {
    const { onChange, query } = this.props
    query.queryType = 'RawQuery'
    query.query = {
      TimeseriesDatabase: this.state.rawState.filter.DatabaseUUID,
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
    query.selectedMeasurements = state.measurementsState.selectedMeasurements?.map((e) => e.value ?? '') ?? []
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
      if (!query?.Measurements && !query?.Measurement) {
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
            saveState={(state) => this.saveState(state, true)}
            onChangeAssetMeasurementQuery={this.onChangeAssetMeasurementQuery}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
          <Measurements
            state={this.state}
            appIsAlertingType={this.appIsAlertingType}
            saveState={(state) => this.saveState(state, true)}
            loadMeasurementOptions={this.loadMeasurementOptions}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
          />
        ),
      },
      {
        title: 'Events',
        content: (
          <Events
            state={this.state}
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
