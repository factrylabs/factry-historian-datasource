import { getOperator } from './util'

// getOperator must not default to '=~' for regex-looking values: '=~' is not in
// the plugin's operator vocabulary (KnownOperator supports '~'), so it would
// reach the historian with an operator the plugin never offers.
describe('getOperator maps regex values to a supported operator', () => {
  it("uses '~' (not '=~') for regex-looking values", () => {
    expect(getOperator({ key: 'k', value: '/motor.*/' })).toBe('~')
  })
})
