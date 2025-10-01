import React, { ChangeEvent, useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, InlineSwitch } from '@grafana/ui'
import { DataSource } from 'datasource'
import { AssetFilter, fieldWidth, labelWidth } from 'types'
import { SelectableValue } from '@grafana/data'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { debouncePromise, useDebounce } from 'QueryEditor/util'

export function AssetFilterRow(props: {
  datasource: DataSource
  onChange: (val: AssetFilter, valid: boolean) => void
  initialValue?: AssetFilter
  templateVariables: Array<SelectableValue<string>>
}) {
  const [parentAssets, setParentAssets] = useState<Array<SelectableValue<string>>>()
  const [path, setPath] = useDebounce<string>(props.initialValue?.Path ?? '', 500, (value) =>
    props.onChange(
      {
        ...props.initialValue,
        Path: value,
      },
      pathValid
    )
  )
  const [pathValid, setPathValid] = useState<boolean>(true)

  const onPathChange = (value: string, valid: boolean) => {
    setPathValid(valid)
    setPath(value)
  }

  const onUseAssetPathChange = (event: ChangeEvent<HTMLInputElement>): void => {
    props.onChange(
      {
        ...props.initialValue,
        UseAssetPath: event.target.checked,
      },
      pathValid
    )
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
    return [{ label: 'No parent', value: '00000000-0000-0000-0000-000000000000' } as SelectableValue<string>].concat(
      selectableValues
    )
  }

  const onParentAssetsChange = (values: Array<SelectableValue<string>>) => {
    props.onChange(
      {
        ...props.initialValue,
        ParentUUIDs: values.map((e) => e.value ?? ''),
      },
      pathValid
    )
    setParentAssets(values)
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Filter by asset path'}
          aria-label={'Filter by asset path'}
          labelWidth={labelWidth}
          tooltip={<div>Searches asset by path, to use a regex surround pattern with /</div>}
        >
          <MaybeRegexInput onChange={onPathChange} initialValue={path} width={fieldWidth} />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label={'Parent assets'}
          aria-label={'Parent assets'}
          labelWidth={labelWidth}
          tooltip={<div>Searches asset by parent assets</div>}
        >
          <AsyncMultiSelect
            width={fieldWidth}
            placeholder="Select parent asset(s)"
            onChange={(value) => onParentAssetsChange(value)}
            defaultOptions
            loadOptions={debouncePromise(loadAssetOptions, 300)}
            value={parentAssets}
          />
        </InlineField>
        <InlineField label={'Use asset path'} tooltip={'Use asset path as display value'} labelWidth={labelWidth}>
          <InlineSwitch value={props.initialValue?.UseAssetPath} onChange={onUseAssetPathChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
