import React, { Component } from 'react'
import { RadioButtonGroup, InlineField, InlineFieldRow } from '@grafana/ui'
import { CoreApp, QueryEditorProps } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { Assets } from 'QueryEditor/Assets'
import { Events } from 'QueryEditor/Events'
import { RawQueryEditor } from 'QueryEditor/RawQueryEditor'
import { Measurements } from 'QueryEditor/Measurements'
import { defaultQueryOptions, migrateMeasurementQuery } from 'QueryEditor/util'
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
  EventPropertyFilter,
} from './types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class QueryEditor extends Component<Props, QueryEditorState> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.onChangeRawQuery = this.onChangeRawQuery.bind(this)
    this.onChangeMeasurementQuery = this.onChangeMeasurementQuery.bind(this)
    this.onChangeAssetMeasurementQuery = this.onChangeAssetMeasurementQuery.bind(this)
    this.onChangeEventQuery = this.onChangeEventQuery.bind(this)
    this.onChangeSeriesLimit = this.onChangeSeriesLimit.bind(this)
  }

  mountFinished = false
  appIsAlertingType = this.props.app === CoreApp.CloudAlerting || this.props.app === CoreApp.UnifiedAlerting
  state = {
    tabIndex: this.props.datasource.defaultTab,
    assetMeasurementQuery: {
      AssetProperties: [] as string[],
      Assets: [] as string[],
      Options: defaultQueryOptions(this.appIsAlertingType),
    },
    measurementQuery: {
      Databases: [] as string[],
      Measurements: [] as string[],
      IsRegex: false,
      Options: defaultQueryOptions(this.appIsAlertingType),
    },
    eventQuery: {
      Type: PropertyType.Simple,
      Assets: [] as string[],
      Statuses: [] as string[],
      PropertyFilter: [] as EventPropertyFilter[],
      EventTypes: [] as string[],
      Properties: [] as string[],
      QueryAssetProperties: false,
    },
    rawQuery: {
      Query: '',
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
    this.setTabIndex(tabIndex)
    try {
      await this.props.datasource.refreshInfo()
    } catch (_) {}
    this.mountFinished = true
    // force re-render
    this.setState({ ...this.state })
  }

  setTabIndex(index: number): void {
    this.setState(
      (prevState) => {
        return { ...prevState, tabIndex: index }
      },
      () => {
        switch (index) {
          case TabIndex.Assets: {
            const query =
              this.props.query.queryType === 'AssetMeasurementQuery'
                ? (this.props.query.query as AssetMeasurementQuery)
                : undefined
            this.onChangeAssetMeasurementQuery(query ?? this.state.assetMeasurementQuery)
            break
          }
          case TabIndex.Measurements: {
            const query =
              this.props.query.queryType === 'MeasurementQuery'
                ? migrateMeasurementQuery(this.props.query.query as MeasurementQuery)
                : undefined
            this.onChangeMeasurementQuery(query ?? this.state.measurementQuery)
            break
          }
          case TabIndex.Events: {
            const query =
              this.props.query.queryType === 'EventQuery' ? (this.props.query.query as EventQuery) : undefined
            this.onChangeEventQuery(query ?? this.state.eventQuery)
            break
          }
          case TabIndex.RawQuery: {
            const query = this.props.query.queryType === 'RawQuery' ? (this.props.query.query as RawQuery) : undefined
            this.onChangeRawQuery(query ?? this.state.rawQuery)
            break
          }
        }
      }
    )
  }

  onChangeAssetMeasurementQuery(assetMeasurementQuery: AssetMeasurementQuery): void {
    const { onChange, query } = this.props
    const updatedQuery = JSON.parse(JSON.stringify(query)) as Query
    updatedQuery.queryType = 'AssetMeasurementQuery'
    updatedQuery.query = assetMeasurementQuery
    updatedQuery.tabIndex = TabIndex.Assets
    updatedQuery.historianInfo = this.props.datasource.historianInfo
    onChange(updatedQuery)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      assetMeasurementQuery: assetMeasurementQuery,
    } as QueryEditorState)
  }

  onChangeMeasurementQuery(measurementQuery: MeasurementQuery): void {
    const { onChange, query } = this.props
    const updatedQuery = JSON.parse(JSON.stringify(query)) as Query
    updatedQuery.queryType = 'MeasurementQuery'
    updatedQuery.query = measurementQuery
    updatedQuery.tabIndex = TabIndex.Measurements
    updatedQuery.historianInfo = this.props.datasource.historianInfo
    onChange(updatedQuery)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      measurementQuery: measurementQuery,
    } as QueryEditorState)
  }

  onChangeRawQuery(rawQuery: RawQuery): void {
    const { onChange, query } = this.props
    const updatedQuery = JSON.parse(JSON.stringify(query)) as Query
    updatedQuery.queryType = 'RawQuery'
    updatedQuery.query = rawQuery
    updatedQuery.tabIndex = TabIndex.RawQuery
    updatedQuery.historianInfo = this.props.datasource.historianInfo
    onChange(updatedQuery)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      rawQuery: rawQuery,
    } as QueryEditorState)
  }

  onChangeEventQuery(eventQuery: EventQuery): void {
    const { onChange, query } = this.props
    const updatedQuery = JSON.parse(JSON.stringify(query)) as Query
    updatedQuery.queryType = 'EventQuery'
    updatedQuery.query = eventQuery
    updatedQuery.tabIndex = TabIndex.Events
    updatedQuery.historianInfo = this.props.datasource.historianInfo
    onChange(updatedQuery)
    this.onRunQuery(this.props)
    this.setState({
      ...this.state,
      eventQuery: eventQuery,
    } as QueryEditorState)
  }

  onChangeSeriesLimit(value: number): void {
    const { onChange, query } = this.props
    const updatedQuery = JSON.parse(JSON.stringify(query)) as Query
    updatedQuery.seriesLimit = value
    updatedQuery.historianInfo = this.props.datasource.historianInfo
    onChange(updatedQuery)
    this.onRunQuery(this.props)
  }

  onRunQuery(
    props: Readonly<Props> &
      Readonly<{
        children?: React.ReactNode
      }>
  ) {
    if (!this.props.query.queryType) {
      return
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
            seriesLimit={this.props.query.seriesLimit}
            datasource={this.props.datasource}
            appIsAlertingType={this.appIsAlertingType}
            templateVariables={this.templateVariables}
            onChangeAssetMeasurementQuery={this.onChangeAssetMeasurementQuery}
            onChangeSeriesLimit={this.onChangeSeriesLimit}
          />
        ),
      },
      {
        title: 'Measurements',
        content: (
          <Measurements
            query={this.props.query.query as MeasurementQuery}
            seriesLimit={this.props.query.seriesLimit}
            appIsAlertingType={this.appIsAlertingType}
            datasource={this.props.datasource}
            templateVariables={this.templateVariables}
            onChangeMeasurementQuery={this.onChangeMeasurementQuery}
            onChangeSeriesLimit={this.onChangeSeriesLimit}
          />
        ),
      },
      {
        title: 'Events',
        content: (
          <Events
            query={this.props.query.query as EventQuery}
            seriesLimit={this.props.query.seriesLimit}
            datasource={this.props.datasource}
            appIsAlertingType={this.appIsAlertingType}
            onChangeEventQuery={this.onChangeEventQuery}
            onChangeSeriesLimit={this.onChangeSeriesLimit}
          />
        ),
      },
      {
        title: 'Raw',
        content: (
          <RawQueryEditor
            query={this.props.query.query as RawQuery}
            datasource={this.props.datasource}
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
        {this.mountFinished && this.props.query.query && tabs[this.state.tabIndex].content}
      </>
    )
  }
}
