import { migrateEventTypePropertiesValuesFilter } from './migration'
import { EventQuery, OldEventTypePropertiesValuesFilter } from '../types'

function makeEventQuery(overrides?: Partial<EventQuery>): EventQuery {
  return {
    Type: 'simple',
    Assets: [],
    EventTypes: [],
    Statuses: [],
    Properties: [],
    PropertyFilter: [],
    QueryAssetProperties: false,
    ...overrides,
  } as EventQuery
}

// migrateEventTypePropertiesValuesFilter must not push the migrated UUID into
// the input's nested Properties array (a shared reference through the shallow
// spread), which would mutate the caller's saved filter.
describe('filter migration does not mutate its input', () => {
  it('leaves the original EventFilter.Properties untouched', () => {
    const old = {
      EventTypePropertyUUID: 'new-uuid',
      EventFilter: makeEventQuery({ Properties: ['existing-uuid'] }),
    } as unknown as OldEventTypePropertiesValuesFilter

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated?.EventFilter.Properties).toEqual(['existing-uuid', 'new-uuid'])
    expect(old.EventFilter.Properties).toEqual(['existing-uuid'])
  })
})
