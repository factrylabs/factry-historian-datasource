import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryOptions } from './QueryOptions'
import { MeasurementQueryOptions } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

// jsdom has no canvas; Combobox measures its option text with one
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ measureText: () => ({ width: 0 }) })) as any
})

const renderOptions = (displayNameTemplate?: string) => {
  render(
    <QueryOptions
      state={{} as MeasurementQueryOptions}
      seriesLimit={50}
      tags={[]}
      valueFilters={[]}
      appIsAlertingType={false}
      datatypes={[]}
      templateVariables={[]}
      onChange={jest.fn()}
      onChangeSeriesLimit={jest.fn()}
      displayNameTemplate={displayNameTemplate}
    />
  )
  fireEvent.click(screen.getByText('Advanced options'))
}

const switchFor = (label: string) => {
  const input = screen.getByText(label).closest('label')!.parentElement!.querySelector('input[type="checkbox"]')
  expect(input).not.toBeNull()
  return input!
}

describe('QueryOptions display name switches', () => {
  it('are enabled without a datasource display name', () => {
    renderOptions()

    expect(switchFor('Display database name')).not.toBeDisabled()
    expect(switchFor('Display description')).not.toBeDisabled()
  })

  it('are disabled when the datasource sets a display name', () => {
    renderOptions('${__field.labels.MeasurementName}')

    expect(switchFor('Display database name')).toBeDisabled()
    expect(switchFor('Display description')).toBeDisabled()
  })
})
