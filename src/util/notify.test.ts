import { AppEvents } from '@grafana/data'

const mockPublish = jest.fn()
jest.mock('@grafana/runtime', () => ({
  getAppEvents: () => ({ publish: mockPublish }),
}))

import { notifyError } from './notify'

describe('notifyError', () => {
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    mockPublish.mockClear()
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('logs and publishes an alertError with the error message', () => {
    notifyError('Failed to load assets', new Error('boom'))

    expect(consoleSpy).toHaveBeenCalledWith('Failed to load assets', expect.any(Error))
    expect(mockPublish).toHaveBeenCalledWith({
      type: AppEvents.alertError.name,
      payload: ['Failed to load assets', 'boom'],
    })
  })

  it('stringifies non-Error values', () => {
    notifyError('Failed', 'oops')

    expect(mockPublish).toHaveBeenCalledWith({
      type: AppEvents.alertError.name,
      payload: ['Failed', 'oops'],
    })
  })
})
