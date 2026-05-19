import { EventQuery, EventTypePropertiesValuesFilter, OldEventTypePropertiesValuesFilter } from 'types'
import { migrateEventTypePropertiesValuesFilter } from './migration'

const baseEventFilter = (overrides: Partial<EventQuery> = {}): EventQuery => ({
  Type: 'simple',
  Assets: [],
  PropertyFilter: [],
  QueryAssetProperties: false,
  OverrideAssets: [],
  OverrideTimeRange: false,
  TimeRange: {},
  Ascending: false,
  ...overrides,
})

describe('migrateEventTypePropertiesValuesFilter', () => {
  it('returns undefined when input is undefined', () => {
    expect(migrateEventTypePropertiesValuesFilter(undefined)).toBeUndefined()
  })

  it('returns an equivalent filter when it is already in the new format', () => {
    const filter: EventTypePropertiesValuesFilter = {
      EventFilter: baseEventFilter({ Properties: ['prop-1'] }),
    }
    const snapshot = JSON.parse(JSON.stringify(filter))

    expect(migrateEventTypePropertiesValuesFilter(filter)).toEqual(filter)
    expect(filter).toEqual(snapshot)
  })

  it('returns an equivalent filter when no EventTypePropertyUUID field is present', () => {
    const filter: EventTypePropertiesValuesFilter = {
      EventFilter: baseEventFilter(),
    }
    const snapshot = JSON.parse(JSON.stringify(filter))

    expect(migrateEventTypePropertiesValuesFilter(filter)).toEqual(filter)
    expect(filter).toEqual(snapshot)
  })

  it('migrates an old filter by moving EventTypePropertyUUID into EventFilter.Properties', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: 'uuid-1',
      EventFilter: baseEventFilter(),
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated).toBeDefined()
    expect(migrated!.EventFilter.Properties).toEqual(['uuid-1'])
    expect((migrated as OldEventTypePropertiesValuesFilter).EventTypePropertyUUID).toBeUndefined()
  })

  // The migrated filter must not push the UUID into the input's nested
  // Properties array (a shared reference through the shallow spread), which
  // would mutate the caller's saved filter.
  it('leaves the original EventFilter.Properties untouched', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: 'new-uuid',
      EventFilter: baseEventFilter({ Properties: ['existing-uuid'] }),
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.EventFilter.Properties).toEqual(['existing-uuid', 'new-uuid'])
    expect(old.EventFilter.Properties).toEqual(['existing-uuid'])
  })

  it('preserves existing Properties when migrating', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: 'uuid-new',
      EventFilter: baseEventFilter({ Properties: ['uuid-existing'] }),
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.EventFilter.Properties).toEqual(['uuid-existing', 'uuid-new'])
  })

  it('does not duplicate the UUID if it is already in Properties', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: 'uuid-dup',
      EventFilter: baseEventFilter({ Properties: ['uuid-dup'] }),
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.EventFilter.Properties).toEqual(['uuid-dup'])
  })

  it('initializes Properties to an empty array when migrating an old filter without Properties', () => {
    const eventFilter = baseEventFilter()
    delete eventFilter.Properties
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: '',
      EventFilter: eventFilter,
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.EventFilter.Properties).toEqual([])
  })

  it('does not add an empty UUID to Properties', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: '',
      EventFilter: baseEventFilter({ Properties: ['existing'] }),
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.EventFilter.Properties).toEqual(['existing'])
  })

  it('preserves top-level fields outside EventTypePropertyUUID', () => {
    const old: OldEventTypePropertiesValuesFilter = {
      EventTypePropertyUUID: 'uuid-1',
      EventFilter: baseEventFilter(),
      From: '2024-01-01',
      To: '2024-01-31',
    }

    const migrated = migrateEventTypePropertiesValuesFilter(old)

    expect(migrated!.From).toBe('2024-01-01')
    expect(migrated!.To).toBe('2024-01-31')
  })
})
