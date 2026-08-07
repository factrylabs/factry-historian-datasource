import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { EventFilter } from './EventFilter'
import { QueryTag } from 'components/TagsSection/TagsSection'
import { DataSource } from 'datasource'
import { EventQuery, EventType, EventTypeProperty, PropertyDatatype, PropertyType } from 'types'

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [] }),
  config: { featureToggles: {} },
}))

jest.mock('@grafana/ui', () => ({
  InlineField: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  InlineFieldRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: () => null,
  MultiSelect: () => null,
}))

// Cascader test double: surface initialLabel as an input value so we can assert
// on the label EventFilter passes down.
jest.mock('components/Cascader/Cascader', () => ({
  __esModule: true,
  default: ({ initialLabel }: { initialLabel: string }) => <input data-testid="assets" readOnly value={initialLabel} />,
}))

// TagsSection test double: keeps a handle on the onChange EventFilter passes
// down so tests can drive the WHERE section without rendering the real editor.
let mockTagsSectionOnChange: ((tags: QueryTag[]) => void) | undefined
jest.mock('components/TagsSection/TagsSection', () => ({
  TagsSection: ({ onChange }: { onChange: (tags: QueryTag[]) => void }) => {
    mockTagsSectionOnChange = onChange
    return null
  },
}))

const createMockDatasource = (overrides: Partial<Record<keyof DataSource, unknown>> = {}) =>
  ({
    getAssets: jest.fn().mockResolvedValue([]),
    getEventTypes: jest.fn().mockResolvedValue([]),
    getEventTypeProperties: jest.fn().mockResolvedValue([]),
    getEventConfigurations: jest.fn().mockResolvedValue([]),
    multiSelectReplace: (value: string) => [value],
    containsTemplate: () => false,
    historianInfo: { Version: '' },
    ...overrides,
  } as unknown as DataSource)

const renderComponent = (assets: string[]) => {
  const query: EventQuery = {
    Assets: assets,
    EventTypes: [],
    Properties: [],
    Statuses: [],
    PropertyFilter: [],
  } as unknown as EventQuery

  return render(<EventFilter query={query} datasource={createMockDatasource()} onChangeQuery={jest.fn()} />)
}

describe('EventFilter', () => {
  it('displays a regex asset instead of clearing it', async () => {
    renderComponent(['/pump.*/'])

    await waitFor(() => {
      expect(screen.getByTestId('assets')).toHaveValue('/pump.*/')
    })
  })

  it('displays a template variable asset', async () => {
    renderComponent(['$myVar'])

    await waitFor(() => {
      expect(screen.getByTestId('assets')).toHaveValue('$myVar')
    })
  })

  it('resolves the datatype of a parent property when the event types are a template variable', async () => {
    const eventTypes: EventType[] = [
      { Name: 'Batch', UUID: 'batch-uuid', Description: '' },
      { Name: 'Phase', UUID: 'phase-uuid', Description: '', ParentUUID: 'batch-uuid' },
    ]
    const eventTypeProperties: EventTypeProperty[] = [
      {
        Name: 'Batch number',
        UUID: 'prop-1',
        EventTypeUUID: 'batch-uuid',
        Datatype: PropertyDatatype.String,
        Type: PropertyType.Simple,
      },
    ]
    const datasource = createMockDatasource({
      getEventTypes: jest.fn().mockResolvedValue(eventTypes),
      getEventTypeProperties: jest.fn().mockResolvedValue(eventTypeProperties),
      multiSelectReplace: (value: string) => (value === '$EventTypes' ? ['phase-uuid'] : [value]),
      containsTemplate: (value: string) => value.startsWith('$'),
    })
    const onChangeQuery = jest.fn()
    const query = {
      Assets: [],
      EventTypes: ['$EventTypes'],
      Properties: [],
      Statuses: [],
      PropertyFilter: [],
      IncludeParentInfo: true,
    } as unknown as EventQuery

    render(<EventFilter query={query} datasource={datasource} onChangeQuery={onChangeQuery} />)
    await waitFor(() => {
      expect(mockTagsSectionOnChange).toBeDefined()
    })

    act(() => {
      mockTagsSectionOnChange!([{ key: 'parent:Batch number', value: '$BatchNumber', operator: 'IN', condition: '' }])
    })

    expect(onChangeQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        PropertyFilter: [
          expect.objectContaining({
            Property: 'parent:Batch number',
            Datatype: PropertyDatatype.String,
            Parent: true,
          }),
        ],
      })
    )
  })
})
