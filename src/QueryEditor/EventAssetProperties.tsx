import React, { useEffect, useState } from 'react'

import { SelectableValue } from '@grafana/data'
import { InlineField, InlineFieldRow } from '@grafana/ui'
import { AssetProperties } from 'components/util/AssetPropertiesSelect'
import { QueryTag } from 'components/TagsSection/types'
import { DataSource } from 'datasource'
import { QueryOptions } from './QueryOptions'
import { Asset, AssetProperty, MeasurementQueryOptions, labelWidth } from 'types'

export interface Props {
  datasource: DataSource
  selectedAssets: Asset[]
  selectedAssetProperties: string[]
  queryType: string
  queryOptions: MeasurementQueryOptions
  tags: QueryTag[]
  appIsAlertingType: boolean
  templateVariables: Array<SelectableValue<string>>
  onChangeAssetProperties: (assetProperties: string[]) => void
  onChangeQueryOptions: (options: MeasurementQueryOptions) => void
}

export const EventAssetProperties = (props: Props): React.JSX.Element => {
  const [assetProperties, setAssetProperties] = useState<AssetProperty[]>([])

  useEffect(() => {
    const load = async () => {
      const result = await props.datasource.getAssetProperties()
      setAssetProperties(result)
    }
    load()
  }, [props.datasource])

  const onChangeAssetProperties = (items: Array<SelectableValue<string>>): void => {
    const selectedAssetProperties = items.map((e) => e.value ?? '')
    props.onChangeAssetProperties(selectedAssetProperties)
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Asset properties" labelWidth={labelWidth} grow>
          <AssetProperties
            assetProperties={assetProperties}
            initialValue={props.selectedAssetProperties}
            selectedAssets={props.selectedAssets}
            templateVariables={props.templateVariables}
            onChange={onChangeAssetProperties}
          />
        </InlineField>
      </InlineFieldRow>
      <QueryOptions
        state={props.queryOptions}
        tags={props.tags}
        appIsAlertingType={props.appIsAlertingType}
        datatypes={[]}
        templateVariables={props.templateVariables}
        hideInterval={props.queryType === 'simple'}
        hideFill={props.queryType === 'simple'}
        hideLimit={props.queryType === 'simple'}
        hideGroupBy={props.queryType === 'simple'}
        hideTagFilter={props.queryType === 'simple'}
        hideAdvancedOptions={props.queryType === 'simple'}
        onChange={props.onChangeQueryOptions}
      />
    </>
  )
}
