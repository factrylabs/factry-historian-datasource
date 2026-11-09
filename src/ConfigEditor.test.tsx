import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataSourceSettings } from '@grafana/data'
import { ConfigEditor } from './ConfigEditor'
import { HistorianDataSourceOptions } from './types'

const makeOptions = (jsonData: Partial<HistorianDataSourceOptions> = {}) =>
  ({
    jsonData: { url: 'http://historian:8000', organization: 'org', ...jsonData },
    secureJsonFields: {},
  }) as unknown as DataSourceSettings<HistorianDataSourceOptions>

describe('ConfigEditor display names', () => {
  it('shows the built-in name structure as placeholder when no template is set', () => {
    render(<ConfigEditor options={makeOptions()} onOptionsChange={jest.fn()} />)

    const assets = document.querySelector('input[name="displayNameAssets"]') as HTMLInputElement
    const measurements = document.querySelector('input[name="displayNameMeasurements"]') as HTMLInputElement
    expect(assets.value).toBe('')
    expect(assets.placeholder).toBe('${__field.labels["AssetPath"]}\\\\${__field.labels["AssetProperty"]}')
    expect(measurements.value).toBe('')
    expect(measurements.placeholder).toBe('${__field.labels["MeasurementName"]}')
  })

  it('stores a template per tab in jsonData', () => {
    const onOptionsChange = jest.fn()
    render(<ConfigEditor options={makeOptions()} onOptionsChange={onOptionsChange} />)

    const assets = document.querySelector('input[name="displayNameAssets"]') as HTMLInputElement
    fireEvent.change(assets, { target: { value: '${__field.labels.AssetProperty}' } })

    expect(onOptionsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ displayNameAssets: '${__field.labels.AssetProperty}' }),
      })
    )
  })

  it('shows a configured template', () => {
    render(
      <ConfigEditor options={makeOptions({ displayNameMeasurements: 'x ${__field.labels.status}' })} onOptionsChange={jest.fn()} />
    )

    expect(screen.getByDisplayValue('x ${__field.labels.status}')).toBeInTheDocument()
  })
})
