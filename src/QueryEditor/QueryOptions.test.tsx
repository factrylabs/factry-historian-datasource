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

const renderOptions = (displayNameTemplate?: string, onChange = jest.fn(), state = {} as MeasurementQueryOptions) => {
  const element = (options: MeasurementQueryOptions) => (
    <QueryOptions
      state={options}
      seriesLimit={50}
      tags={[]}
      valueFilters={[]}
      appIsAlertingType={false}
      datatypes={[]}
      templateVariables={[]}
      onChange={onChange}
      onChangeSeriesLimit={jest.fn()}
      displayNameTemplate={displayNameTemplate}
    />
  )
  const { rerender } = render(element(state))
  fireEvent.click(screen.getByText('Advanced options'))
  return (options: MeasurementQueryOptions) => rerender(element(options))
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

describe('QueryOptions query name', () => {
  it('sets the query name when the input loses focus', () => {
    const onChange = jest.fn()
    renderOptions(undefined, onChange)

    const input = screen.getByPlaceholderText('Prefixes the series names')
    fireEvent.change(input, { target: { value: 'Mean 5m' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ QueryName: 'Mean 5m' }))
  })

  it('does not change the query when the name is left as it was', () => {
    const onChange = jest.fn()
    renderOptions(undefined, onChange, { QueryName: 'Mean' } as MeasurementQueryOptions)

    const input = screen.getByPlaceholderText('Prefixes the series names')
    fireEvent.change(input, { target: { value: ' Mean ' } })
    fireEvent.blur(input)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a query name changed outside the input', () => {
    const rerender = renderOptions(undefined, jest.fn(), { QueryName: 'Mean' } as MeasurementQueryOptions)

    rerender({ QueryName: 'Max' } as MeasurementQueryOptions)

    expect(screen.getByPlaceholderText('Prefixes the series names')).toHaveValue('Max')
  })

  it('stays enabled when the datasource sets a display name', () => {
    renderOptions('${__field.labels.MeasurementName}')

    expect(screen.getByPlaceholderText('Prefixes the series names')).not.toBeDisabled()
  })
})
