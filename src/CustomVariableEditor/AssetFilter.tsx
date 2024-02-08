import React, { ChangeEvent, FormEvent, useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, Input } from '@grafana/ui'
import { DataSource } from 'datasource'
import { AssetFilter } from 'types'
import { SelectableValue } from '@grafana/data'

export function AssetFilterRow(props: {
  datasource: DataSource
  onChange: (val: AssetFilter) => void
  initialValue?: AssetFilter
  templateVariables: Array<SelectableValue<string>>
}) {
  const [parentAssets, setParentAssets] = useState<Array<SelectableValue<string>>>()
  let initialLoadDone = false

  const onPathChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Path: (event as ChangeEvent<HTMLInputElement>).target.value,
    })
  }

  const loadAssetOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: AssetFilter = {
      Keyword: query,
    }
    const databases = await props.datasource.getAssets(filter)
    const selectableValues = databases
      .map((e) => {
        return {
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!initialLoadDone) {
      setParentAssets(selectableValues.filter((e) => props.initialValue?.ParentUUIDs?.includes(e.value ?? '')))
      initialLoadDone = true
    }
    return selectableValues
  }

  const onParentAssetsChange = (values: Array<SelectableValue<string>>) => {
    props.onChange({
      ...props.initialValue,
      ParentUUIDs: values.map((e) => e.value ?? ''),
    })
    setParentAssets(values)
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Path'}
          aria-label={'Path'}
          labelWidth={20}
          tooltip={<div>Searches asset by path, to use a regex surround pattern with /</div>}
        >
          <Input value={props.initialValue?.Path} onChange={onPathChange} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={'Parent assets'}
          aria-label={'Parent assets'}
          labelWidth={20}
          tooltip={<div>Searches asset by parent assets</div>}
        >
          <AsyncMultiSelect
            placeholder="Select parent asset(s)"
            onChange={(value) => onParentAssetsChange(value)}
            defaultOptions
            loadOptions={loadAssetOptions}
            value={parentAssets}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
