import React, { Component } from 'react'
import { QueryEditorProps } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { Events } from 'QueryEditor/Events'
import { DataSource } from 'datasource'
import { HistorianDataSourceOptions, Query, EventQuery, PropertyType, HistorianInfo } from 'types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class AnnotationsQueryEditor extends Component<Props> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.onChangeEventQuery = this.onChangeEventQuery.bind(this)
    this.onChangeSeriesLimit = this.onChangeSeriesLimit.bind(this)
  }

  historianInfo: HistorianInfo | undefined
  templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  async componentDidMount(): Promise<void> {
    const { query } = this.props

    try {
      this.historianInfo = await this.props.datasource.getInfo()
    } catch (_) {}
    if (!query.query) {
      this.onChangeEventQuery({
        Type: PropertyType.Simple,
        Assets: [],
        Statuses: [],
        PropertyFilter: [],
        EventTypes: [],
        Properties: [],
        QueryAssetProperties: false,
      })
    }
  }

  onChangeEventQuery(eventQuery: EventQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'EventQuery'
    query.query = eventQuery
    query.historianInfo = this.historianInfo
    onChange(query)
    this.onRunQuery(this.props)
  }

  onChangeSeriesLimit(value: number): void {
    const { onChange, query } = this.props
    query.seriesLimit = value
    query.historianInfo = this.historianInfo
    onChange(query)
    this.onRunQuery(this.props)
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

    if (props.query.queryType === 'EventQuery') {
      const query = props.query.query as EventQuery
      if (!query?.EventTypes || !query?.Assets) {
        return
      }
    }

    this.props.onRunQuery()
  }

  render() {
    return (
      <>
        {this.props.query.query && (
          <Events
            query={this.props.query.query as EventQuery}
            seriesLimit={this.props.query.seriesLimit}
            datasource={this.props.datasource}
            isAnnotationQuery
            onChangeEventQuery={this.onChangeEventQuery}
            onChangeSeriesLimit={this.onChangeSeriesLimit}
          />
        )}
      </>
    )
  }
}
