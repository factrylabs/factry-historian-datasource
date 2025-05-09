import React, { useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import { DataSource } from 'datasource'
import { AssetFilter, AssetPropertyFilter, fieldWidth, HistorianInfo, labelWidth, MeasurementDatatype } from 'types'
import { SelectableValue } from '@grafana/data'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { isFeatureEnabled } from 'util/semver'
import { sortByLabel, useDebounce } from 'QueryEditor/util'

export function AssetPropertyFilterRow(props: {
  datasource: DataSource
  onChange: (val: AssetPropertyFilter, valid: boolean) => void
  initialValue?: AssetPropertyFilter
  templateVariables: SelectableValue<string>
  historianInfo?: HistorianInfo | undefined
}) {
  const [selectedAssets, setAssets] = useState<Array<SelectableValue<string>>>()
  const [keyword, setKeyword] = useDebounce<string>(props.initialValue?.Keyword ?? '', 500, (value) =>
    props.onChange(
      {
        ...props.initialValue,
        Keyword: value,
      },
      keywordValid
    )
  )
  const [keywordValid, setKeywordValid] = useState<boolean>(true)

  const onAssetsChange = (values: Array<SelectableValue<string>>) => {
    props.onChange(
      {
        ...props.initialValue,
        AssetUUIDs: values.map((e) => e.value ?? ''),
      },
      keywordValid
    )
    setAssets(values)
  }

  const onKeywordChange = (value: string, valid: boolean) => {
    setKeywordValid(valid)
    setKeyword(value)
  }

  const onDatatypesChange = (items: Array<SelectableValue<string>> | undefined) => {
    const datatypes = items?.map((e) => {
      return e.value || ''
    })
    props.onChange(
      {
        ...props.initialValue,
        Datatypes: datatypes,
      },
      keywordValid
    )
  }

  const loadAssetOptions = async (query: string): Promise<Array<SelectableValue<string>>> => {
    const filter: AssetFilter = {
      Path: query,
      UseAssetPath: true,
    }
    const assets = await props.datasource.getAssets(filter)
    const selectableValues = assets
      .map((e) => {
        return {
          label: e.AssetPath ? e.AssetPath : e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .sort(sortByLabel)
      .concat(props.templateVariables)
    if (!selectedAssets) {
      setAssets(selectableValues.filter((e) => props.initialValue?.AssetUUIDs?.includes(e.value ?? '')))
    }
    return selectableValues
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Assets'} aria-label={'Assets'} labelWidth={labelWidth}>
          <AsyncMultiSelect
            placeholder="Select asset(s)"
            width={fieldWidth}
            onChange={(value) => onAssetsChange(value)}
            defaultOptions
            loadOptions={loadAssetOptions}
            value={selectedAssets}
          />
        </InlineField>
      </InlineFieldRow>
      {props.historianInfo && isFeatureEnabled(props.historianInfo.Version, '7.3.0', true) && (
        <>
          <InlineFieldRow>
            <InlineField
              label={'Filter by keyword'}
              aria-label={'Filter by keyword'}
              labelWidth={labelWidth}
              tooltip={
                <div>Searches asset property by name or description, to use a regex surround pattern with /</div>
              }
            >
              <MaybeRegexInput onChange={onKeywordChange} initialValue={keyword} width={fieldWidth} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label={'Filter by datatype'}
              aria-label={'Filter by datatype'}
              labelWidth={labelWidth}
              tooltip={<div>Searches asset property by datatype</div>}
            >
              <MultiSelect
                placeholder="All datatypes"
                width={fieldWidth}
                onChange={(value) => onDatatypesChange(value)}
                value={props.initialValue?.Datatypes}
                options={Object.entries(MeasurementDatatype).map(([_, value]) => {
                  return { label: value, value: value as string }
                })}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
    </>
  )
}
