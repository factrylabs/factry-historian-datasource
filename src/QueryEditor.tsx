import React, { Component } from 'react'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { CoreApp, QueryEditorProps } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { Assets } from 'QueryEditor/Assets'
import { Events } from 'QueryEditor/Events'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { Measurements } from 'QueryEditor/Measurements'
import { defaultQueryOptions } from 'QueryEditor/util'
import { DataSource } from './datasource'
import {
  HistorianDataSourceOptions,
  MeasurementQuery,
  Query,
  RawQuery,
  QueryEditorState,
  EventQuery,
  AssetMeasurementQuery,
  TabIndex,
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
    rawState: {
      rawQuery: {
        Query: '',
        TimeseriesDatabase: '',
      },
      filter: {
        Database: '',
      },
    },
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
    switch (tabIndex) {
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
              this.onChangeAssetMeasurementQuery(
                this.state.assetMeasurementQuery ?? {
                  AssetProperties: [],
                  Assets: [],
                  Options: defaultQueryOptions(this.appIsAlertingType),
                }
              )
              break
            case TabIndex.Measurements:
              this.onChangeMeasurementQuery(
                this.state.measurementQuery ?? {
                  Databases: [],
                  Measurements: [],
                  IsRegex: false,
                  Options: defaultQueryOptions(this.appIsAlertingType),
                }
              )
              break
            case TabIndex.Events:
              this.onChangeEventQuery(
                this.state.eventQuery ?? {
                  Type: PropertyType.Simple,
                  Assets: [],
                  Statuses: [],
                  PropertyFilter: [],
                  EventTypes: [],
                  Properties: [],
                  QueryAssetProperties: false,
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

  onChangeAssetMeasurementQuery(assetMeasurementQuery: AssetMeasurementQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'AssetMeasurementQuery'
    query.query = assetMeasurementQuery
    onChange(query)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      assetMeasurementQuery: assetMeasurementQuery,
    } as QueryEditorState)
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
            query={this.props.query.query as AssetMeasurementQuery}
            datasource={this.props.datasource}
            appIsAlertingType={this.appIsAlertingType}
            templateVariables={this.templateVariables}
            onChangeAssetMeasurementQuery={this.onChangeAssetMeasurementQuery}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
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
            query={this.props.query.query as EventQuery}
            datasource={this.props.datasource}
            appIsAlertingType={this.appIsAlertingType}
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
        {!this.state.loading && this.props.query.query && tabs[this.state.tabIndex].content}
      </>
    )
  }
}
