import React, { ChangeEvent, PureComponent } from 'react'
import { FieldSet, InlineField, InlineFieldRow, Input, SecretInput } from '@grafana/ui'

import { DataSourcePluginOptionsEditorProps } from '@grafana/data'
import { HistorianDataSourceOptions, HistorianSecureJsonData } from './types'

interface Props extends DataSourcePluginOptionsEditorProps<HistorianDataSourceOptions> { }

interface State { }

export class ConfigEditor extends PureComponent<Props, State> {
  onSettingChange = (prop: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      [prop]: event.target.value,
    };
    onOptionsChange({ ...options, jsonData })
  }

  onSecureSettingChange = (prop: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        [prop]: event.target.value,
      },
    })
  }

  onSecureSettingReset = (prop: string) => () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        [prop]: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        [prop]: '',
      },
    })
  }

  render() {
    const { options } = this.props
    const { jsonData, secureJsonFields } = options
    const secureJsonData = (options.secureJsonData || {}) as HistorianSecureJsonData

    return (
      <div className="gf-form-group">
        <FieldSet label="Connection settings">
          <InlineFieldRow>
            <InlineField
              label="URL"
              labelWidth={20}
              tooltip="Specify the URL on which to contact the rest API"
            >
              <Input
                width={61}
                name="url"
                onChange={this.onSettingChange('url')}
                value={jsonData.url || ''}
                placeholder="http://127.0.0.1:8000"
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField label="Token" labelWidth={20}>
              <SecretInput
                name="token"
                isConfigured={(secureJsonFields && secureJsonFields.token) as boolean}
                value={secureJsonData.token || ''}
                placeholder="token"
                width={61}
                onReset={this.onSecureSettingReset('token')}
                onChange={this.onSecureSettingChange('token')}
              />
            </InlineField>
          </InlineFieldRow>
          <InlineFieldRow>
            <InlineField
              label="Organization"
              labelWidth={20}
              tooltip="Specify the organization UUID"
            >
              <Input
                width={61}
                name="url"
                onChange={this.onSettingChange('organization')}
                value={jsonData.organization || ''}
              />
            </InlineField>
          </InlineFieldRow>
        </FieldSet>
      </div>
    )
  }
}
