import React, { useState } from 'react'

import { AsyncMultiSelect, InlineField, InlineFieldRow, MultiSelect } from '@grafana/ui'
import { DataSource } from 'datasource'
import { AssetFilter, AssetPropertyFilter, HistorianInfo, MeasurementDatatype } from 'types'
import { SelectableValue } from '@grafana/data'
import { MaybeRegexInput } from 'components/util/MaybeRegexInput'
import { isFeatureEnabled } from 'util/semver'

export function AssetPropertyFilterRow(props: {
  datasource: DataSource
  onChange: (val: AssetPropertyFilter, valid: boolean) => void
  initialValue?: AssetPropertyFilter
  templateVariables: SelectableValue<string>
  historianInfo?: HistorianInfo | undefined
}) {
  const [selectedAssets, setAssets] = useState<Array<SelectableValue<string>>>()
  const [keywordValid, setKeywordValid] = useState<boolean>(true)

  const onAssetsChange = (values: Array<SelectableValue<string>>) => {
    props.onChange({
      ...props.initialValue,
      AssetUUIDs: values.map((e) => e.value ?? ''),
    }, keywordValid)
    setAssets(values)
  }

  const onKeywordChange = (value: string, valid: boolean) => {
    setKeywordValid(valid)
    props.onChange(
      {
        ...props.initialValue,
        Keyword: value,
      },
      valid
    )
  }

  const onDatatypesChange = (items: Array<SelectableValue<string>> | undefined) => {
    const datatypes = items?.map((e) => {
      return e.value || ''
    })
    props.onChange({
      ...props.initialValue,
      Datatypes: datatypes,
    }, keywordValid)
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
          label: e.Name,
          value: e.UUID,
        } as SelectableValue<string>
      })
      .concat(props.templateVariables)
    if (!selectedAssets) {
      setAssets(selectableValues.filter((e) => props.initialValue?.AssetUUIDs?.includes(e.value ?? '')))
    }
    return selectableValues
  }
  return (
    <>
      <InlineFieldRow>
        <InlineField label={'Assets'} aria-label={'Assets'} labelWidth={20}>
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
      { props.historianInfo && isFeatureEnabled(props.historianInfo.Version, '7.3.0', true) && (
        <>
          <InlineFieldRow>
            <InlineField
              label={'Filter by keyword'}
              aria-label={'Filter by keyword'}
              labelWidth={20}
              tooltip={<div>Searches asset property by name or  description, to use a regex surround pattern with /</div>}
            >
              <MaybeRegexInput onChange={onKeywordChange} initialValue={props.initialValue?.Keyword} />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label={'Filter by datatype'}
              aria-label={'Filter by datatype'}
              labelWidth={20}
              tooltip={<div>Searches asset property by datatype</div>}
            >
              <MultiSelect
                placeholder='All datatypes'
                onChange={(value) => onDatatypesChange(value)}
                value={props.initialValue?.Datatypes}
                options={Object.entries(MeasurementDatatype)
                              .map(([key, value]) => {
                                return { label: key, value: value as string }
                              })}
              />
            </InlineField>
          </InlineFieldRow>
        </>
      )}
    </>
  )
}
