import { AppEvents } from '@grafana/data'
import { getAppEvents } from '@grafana/runtime'

// Logs an error and surfaces it to the user as a Grafana error toast. Used by
// the async asset-loading handlers so failures aren't silently swallowed.
export function notifyError(title: string, error: unknown): void {
  console.error(title, error)
  getAppEvents().publish({
    type: AppEvents.alertError.name,
    payload: [title, error instanceof Error ? error.message : String(error)],
  })
}
