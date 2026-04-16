const grafanaConfig = require('@grafana/eslint-config/flat')

/**
 * @type {Array<import('eslint').Linter.Config>}
 */
module.exports = [
  {
    ignores: [
      '**/dist/',
      '**/artifacts/',
      '**/coverage/',
      '**/work/',
      '**/ci/',
      '**/e2e-results/',
      '.config/',
      'factry-historian-datasource/',
    ],
  },
  ...grafanaConfig,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },
]
