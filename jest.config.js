// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC'

const baseConfig = require('./.config/jest.config')

module.exports = {
  ...baseConfig,
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        jsc: {
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: false,
            dynamicImport: true,
          },
          // Pin to es2022 — the installed @swc/core does not support es2023
          target: 'es2022',
        },
      },
    ],
  },
}
