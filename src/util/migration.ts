import { EventTypePropertiesValuesFilter, OldEventTypePropertiesValuesFilter } from 'types'

function isOldEventTypePropertiesValuesFilter(filter: any): filter is OldEventTypePropertiesValuesFilter {
  return 'EventTypePropertyUUID' in filter
}

/**
 * Migrates an old EventTypePropertiesValuesFilter to the current format.
 *
 * This function detects and transforms filters using the deprecated
 * `EventTypePropertyUUID` field into the current format where the UUID
 * is moved into the `EventFilter.Properties` array.
 *
 * @param old - The filter object, possibly in a deprecated format.
 * @returns A migrated filter conforming to the current EventTypePropertiesValuesFilter interface.
 *
 * @remarks
 * The old format using `EventTypePropertyUUID` was deprecated in v2.2.0.
 * Use EventFilter.Properties[] instead to define filter properties.
 */
export function migrateEventTypePropertiesValuesFilter(
  old: OldEventTypePropertiesValuesFilter | EventTypePropertiesValuesFilter | undefined
): EventTypePropertiesValuesFilter | undefined {
  if (!old) {
    return undefined
  }

  if (!isOldEventTypePropertiesValuesFilter(old)) {
    return old
  }

  const { EventTypePropertyUUID, ...rest } = old

  const migrated = {
    ...rest,
    EventFilter: {
      ...rest.EventFilter,
      Properties: rest.EventFilter?.Properties ?? [],
    },
  }

  if (EventTypePropertyUUID && !migrated.EventFilter.Properties.includes(EventTypePropertyUUID)) {
    migrated.EventFilter.Properties.push(EventTypePropertyUUID)
  }

  return migrated
}
