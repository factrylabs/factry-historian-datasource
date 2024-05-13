import React, { ChangeEvent, FormEvent, useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, InlineSwitch, Input } from '@grafana/ui'
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

  const onPathChange = (event: FormEvent<HTMLInputElement>) => {
    props.onChange({
      ...props.initialValue,
      Path: (event as ChangeEvent<HTMLInputElement>).target.value,
    })
  }

  const onUseAssetPathChange = (event: ChangeEvent<HTMLInputElement>): void => {
    props.onChange({
      ...props.initialValue,
      UseAssetPath: event.target.checked,
    })
  }

  const loadAssetOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: AssetFilter = {
      Keyword: query,
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
    if (!parentAssets) {
      setParentAssets(selectableValues.filter((e) => props.initialValue?.ParentUUIDs?.includes(e.value ?? '')))
    }
    return [{ label: 'No parent', value: '00000000-0000-0000-0000-000000000000' } as SelectableValue<string>].concat(selectableValues)
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
          label={'Filter by asset path'}
          aria-label={'Filter by asset path'}
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
        <InlineField label={'Use asset path'} tooltip={'Use asset path as display value'} labelWidth={20}>
          <InlineSwitch value={props.initialValue?.UseAssetPath} onChange={onUseAssetPathChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
