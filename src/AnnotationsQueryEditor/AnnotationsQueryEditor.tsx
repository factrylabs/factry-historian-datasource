import React, { Component } from 'react'
import { QueryEditorProps } from '@grafana/data'
import { getTemplateSrv } from '@grafana/runtime'
import { toSelectableValue } from 'components/TagsSection/util'
import { Events } from 'QueryEditor/Events'
import { propertyFilterToQueryTags, sortByName } from 'QueryEditor/util'
import { DataSource } from 'datasource'
import {
  HistorianDataSourceOptions,
  Query,
  QueryEditorState,
  EventQuery,
  Measurement,
  PropertyType,
  AnnotationsQueryEditorState,
} from 'types'

type Props = QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>

export class AnnotationsQueryEditor extends Component<Props, AnnotationsQueryEditorState> {
  constructor(props: QueryEditorProps<DataSource, Query, HistorianDataSourceOptions>) {
    super(props)
    this.onChangeEventQuery = this.onChangeEventQuery.bind(this)
    this.saveState = this.saveState.bind(this)
  }

  state = {
    loading: true,
    assetProperties: [],
    assets: [],
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
    eventTypes: [],
    eventTypeProperties: [],
    eventConfigurations: [],
  } as AnnotationsQueryEditorState

  templateVariables = getTemplateSrv()
    .getVariables()
    .map((e) => {
      return { label: `$${e.name}`, value: `$${e.name}` }
    })

  async componentDidMount(): Promise<void> {
    const { query } = this.props
    this.setState((prevState) => {
      return {
        ...prevState,
        eventsState: {
          ...this.state.eventsState,
          selectedAsset: query.selectedAssetPath,
        },
      }
    })

    await this.loadData()

    if (!query.query) {
      this.setState(
        (prevState) => {
          return {
            ...prevState,
            loading: false,
          }
        },
        () => {
          this.saveState(this.state)
        }
      )
    } else {
      const eventQuery = query.query as EventQuery
      this.setState(
        (prevState) => {
          return {
            ...prevState,
            loading: false,
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
    }
  }

  async loadData(): Promise<void[]> {
    let promises = []
    promises.push(this.getAssets())
    promises.push(this.getEventTypes())
    promises.push(this.getEventTypeProperties())
    promises.push(this.getEventConfigurations())

    return Promise.all(promises)
  }

  async getAssets(): Promise<void> {
    await this.props.datasource.getAssets().then(async (assets) => {
      const assetProperties = await this.props.datasource.getAssetProperties()
      let measurements: Measurement[] = []
      await Promise.all(
        assets.map(async (asset) => {
          let m = await this.props.datasource.getMeasurements({ AssetUUID: asset.UUID }, { Limit: 100, Page: 1 })
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

  onChangeEventQuery(eventQuery: EventQuery): void {
    const { onChange, query } = this.props
    query.queryType = 'EventQuery'
    query.query = eventQuery
    onChange(query)
    this.onRunQuery(this.props)
  }

  saveState(state: AnnotationsQueryEditorState, updateState = false): void {
    const { onChange, query } = this.props
    if (!query) {
      return
    }

    query.selectedAssetPath = state.eventsState.selectedAsset

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
        {!this.state.loading && (
          <Events
            datasource={this.props.datasource}
            state={this.state as QueryEditorState}
            isAnnotationQuery
            saveState={(state) => this.saveState(state, true)}
            onChangeEventQuery={this.onChangeEventQuery}
          />
        )}
      </>
    )
  }
}
