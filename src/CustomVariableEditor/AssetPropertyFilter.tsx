import React, { useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow } from '@grafana/ui'
import { DataSource } from 'datasource'
import { AssetFilter, AssetPropertyFilter } from 'types'
import { SelectableValue } from '@grafana/data'

export function AssetPropertyFilterRow(props: {
  datasource: DataSource
  onChange: (val: AssetPropertyFilter) => void
  initialValue?: AssetPropertyFilter
  templateVariables: SelectableValue<string>
}) {
  const [selectedAssets, setAssets] = useState<Array<SelectableValue<string>>>()
  let initialLoadDone = false

  const onAssetsChange = (values: Array<SelectableValue<string>>) => {
    props.onChange({
      ...props.initialValue,
      AssetUUIDs: values.map((e) => e.value ?? ''),
    })
    setAssets(values)
  }

  const loadAssetOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: AssetFilter = {
      Path: query,
    }
    const assets = await props.datasource.getAssets(filter)
    const selectableValues = assets
      .map((e) => {
        return {
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!initialLoadDone) {
      setAssets(selectableValues.filter((e) => props.initialValue?.AssetUUIDs?.includes(e.value ?? '')))
      initialLoadDone = true
    }
    return selectableValues
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Assets'}
          aria-label={'Assets'}
          labelWidth={20}
          tooltip={<div>Searches assets by path, to use a regex surround pattern with /</div>}
        >
          <AsyncMultiSelect
            placeholder="Select asset(s)"
            width={25}
            onChange={(value) => onAssetsChange(value)}
            defaultOptions
            loadOptions={loadAssetOptions}
            value={selectedAssets}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
