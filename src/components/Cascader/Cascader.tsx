import { css } from '@emotion/css'
import memoizeOne from 'memoize-one'
import RCCascader from 'rc-cascader'
import React, { PureComponent } from 'react'

import { SelectableValue } from '@grafana/data'

import { Icon, Input } from '@grafana/ui'

import { onChangeCascader } from './optionMappings'
import { Autocomplete } from '../Autocomplete/Autocomplete'
import { findOption } from 'QueryEditor/util'

export interface CascaderProps {
  /** The separator between levels in the search */
  separator?: string
  placeholder?: string
  options: CascaderOption[]
  /** Changes the value for every selection, including branch nodes. Defaults to true. */
  changeOnSelect?: boolean
  onSelect(asset: string, property?: string): void
  /** Sets the width to a multiple of 8px. Should only be used with inline forms. Setting width of the container is preferred in other cases.*/
  width?: number
  initialValue?: string
  initialLabel?: string
  allowCustomValue?: boolean
  /** A function for formatting the message for custom value creation. Only applies when allowCustomValue is set to true*/
  formatCreateLabel?: (val: string) => string
  /** If true all levels are shown in the input by simple concatenating the labels */
  displayAllSelectedLevels?: boolean
  onBlur?: () => void
  /** When mounted focus automatically on the input */
  autoFocus?: boolean
  /** Keep the dropdown open all the time, useful in case whole cascader visibility is controlled by the parent */
  alwaysOpen?: boolean
  /** Don't show what is selected in the cascader input/search. Useful when input is used just as search and the
      cascader is hidden after selection. */
  hideActiveLevelLabel?: boolean
}

interface CascaderState {
  isSearching: boolean
  focusCascade: boolean
  //Array for cascade navigation
  rcValue: SelectableValue<string[]>
  activeLabel: string
  activeSuggestion: number
  filteredSuggestions: string[]
  showSuggestions: boolean
}

export interface CascaderOption {
  /**
   *  The value used under the hood
   */
  value: any
  /**
   *  The label to display in the UI
   */
  label: string
  /** Items will be just flattened into the main list of items recursively. */
  items?: CascaderOption[]
  disabled?: boolean
  /** Avoid using */
  title?: string
  /**  Children will be shown in a submenu. Use 'items' instead, as 'children' exist to ensure backwards compatibility.*/
  children?: CascaderOption[]
}

const disableDivFocus = css(`
&:focus{
  outline: none;
}
`)

const DEFAULT_SEPARATOR = '/'

export class Cascader extends PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props)
    const rcValue = [props.initialValue]
    const activeLabel = props.initialLabel || ''
    this.state = {
      isSearching: false,
      focusCascade: false,
      rcValue,
      activeLabel,
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestions: false,
    }
  }

  static defaultProps = { changeOnSelect: true }

  flattenOptions = (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
    let selectOptions: Array<SelectableValue<string[]>> = []
    for (const option of options) {
      const cpy = [...optionPath]
      cpy.push(option)
      if (!option.items || option.items.length === 0) {
        selectOptions.push({
          singleLabel: cpy[cpy.length - 1].label,
          label: cpy.map((o) => o.label).join(this.props.separator || ` ${DEFAULT_SEPARATOR} `),
          value: cpy.map((o) => o.value),
        })
      } else {
        selectOptions.push({
          singleLabel: cpy[cpy.length - 1].label,
          label: cpy.map((o) => o.label).join(this.props.separator || ` ${DEFAULT_SEPARATOR} `),
          value: cpy.map((o) => o.value),
        })
        selectOptions = [...selectOptions, ...this.flattenOptions(option.items, cpy)]
      }
    }
    return selectOptions
  }

  getSearchableOptions = memoizeOne((options: CascaderOption[]) => this.flattenOptions(options))

  setInitialValue(searchableOptions: Array<SelectableValue<string[]>>, initValue?: string) {
    if (!initValue) {
      return { rcValue: [], activeLabel: '' }
    }
    for (const option of searchableOptions) {
      const optionPath = option.value || []

      if (optionPath.indexOf(initValue) === optionPath.length - 1) {
        return {
          rcValue: optionPath,
          activeLabel: this.props.displayAllSelectedLevels ? option.label : option.singleLabel || '',
        }
      }
    }
    if (this.props.allowCustomValue) {
      return { rcValue: [], activeLabel: initValue }
    }
    return { rcValue: [], activeLabel: '' }
  }

  //For rc-cascader
  onChange = (value: string[], selectedOptions: CascaderOption[]) => {
    const activeLabel = this.props.hideActiveLevelLabel
      ? ''
      : this.props.displayAllSelectedLevels
      ? selectedOptions
          .filter((option) => !option.label.startsWith('📏'))
          .map((option) => option.label)
          .join(this.props.separator || DEFAULT_SEPARATOR)
      : selectedOptions[selectedOptions.length - 1].label
    const propertySelected = selectedOptions[selectedOptions.length - 1].label.startsWith('📏')
    const assetSelected = selectedOptions[selectedOptions.length - 1].label.startsWith('📦')
    this.setState({
      rcValue: value,
      focusCascade: assetSelected,
      activeLabel,
    })
    if (propertySelected) {
      this.props.onSelect(
        selectedOptions[selectedOptions.length - 2].value,
        selectedOptions[selectedOptions.length - 1].value
      )
    } else {
      this.props.onSelect(selectedOptions[selectedOptions.length - 1].value)
    }
  }

  onBlur = () => {
    this.setState({
      focusCascade: false,
    })

    if (this.state.activeLabel === '') {
      this.setState({
        rcValue: [],
      })
    }
    this.props.onBlur?.()
  }

  onBlurCascade = () => {
    this.setState({
      focusCascade: false,
    })

    this.props.onBlur?.()
  }

  handleChange(e: any) {
    const suggestions: string[] = this.getSearchableOptions(this.props.options).map((e) => e.label || '')
    const userInput: string = e.target.value
    const filteredSuggestions: string[] = suggestions.filter(
      (suggestion) => suggestion.toLowerCase().indexOf(userInput.toLowerCase()) > -1
    )

    this.setState({
      activeLabel: userInput,
      focusCascade: userInput.length === 0,
      showSuggestions: true,
      filteredSuggestions: filteredSuggestions,
    })
    this.props.onSelect(userInput)
  }

  onClickSuggestion = (e: any) => {
    const option = findOption(this.getSearchableOptions(this.props.options), e.currentTarget.innerText)
    let activeLabel: string = option?.label || e.currentTarget.innerText
    if (option && option.value && option.value.length > 0) {
      if (option.singleLabel?.startsWith('📏 ')) {
        activeLabel = activeLabel.substring(0, activeLabel.length - (option.singleLabel.length + 2))
        this.props.onSelect(option.value[option.value.length - 2], option.value[option.value.length - 1])
      } else {
        this.props.onSelect(option.value[option.value.length - 1])
      }
    }
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestions: false,
      activeLabel: activeLabel,
    })
  }

  onKeyDown = (e: any) => {
    const { activeSuggestion, filteredSuggestions } = this.state
    if (e.keyCode === 13) {
      const option = findOption(this.getSearchableOptions(this.props.options), filteredSuggestions[activeSuggestion])
      let activeLabel: string = option?.label || filteredSuggestions[activeSuggestion]
      if (option && option.value && option.value.length > 0) {
        if (option.singleLabel?.startsWith('📏 ')) {
          activeLabel = activeLabel.substring(0, activeLabel.length - (option.singleLabel.length + 2))
          this.props.onSelect(option.value[option.value.length - 2], option.value[option.value.length - 1])
        } else {
          this.props.onSelect(option.value[option.value.length - 1])
        }
      }
      this.setState({
        activeSuggestion: 0,
        showSuggestions: false,
        activeLabel: activeLabel,
      })
    } else if (e.keyCode === 38) {
      if (activeSuggestion === 0) {
        return
      }
      this.setState({ activeSuggestion: activeSuggestion - 1 })
    }
    // User pressed the down arrow, increment the index
    else if (e.keyCode === 40) {
      if (activeSuggestion - 1 === filteredSuggestions.length) {
        return
      }
      this.setState({ activeSuggestion: activeSuggestion + 1 })
    }
  }

  openCascade = () => {
    this.setState({ focusCascade: true })
  }

  render() {
    const { placeholder, width, changeOnSelect, options } = this.props
    const { focusCascade, rcValue, activeLabel, activeSuggestion, filteredSuggestions, showSuggestions } = this.state

    this.getSearchableOptions(options)

    return (
      <div>
        <RCCascader
          onChange={onChangeCascader(this.onChange)}
          options={options}
          changeOnSelect={changeOnSelect}
          value={rcValue.value}
          fieldNames={{ label: 'label', value: 'value', children: 'items' }}
          expandIcon={null}
          open={focusCascade}
        >
          <div className={disableDivFocus}>
            <Input
              autoFocus={this.props.autoFocus}
              width={width}
              placeholder={placeholder}
              onBlur={this.onBlurCascade}
              value={activeLabel?.replace(new RegExp('📦 ', 'g'), '')}
              onKeyDown={this.onKeyDown}
              onChange={this.handleChange.bind(this)}
              onFocus={this.openCascade}
              suffix={
                focusCascade ? (
                  <Icon name="angle-up" />
                ) : (
                  <Icon name="angle-down" style={{ marginBottom: 0, marginLeft: '4px' }} />
                )
              }
            />
            <Autocomplete
              activeLabel={activeLabel}
              activeSuggestion={activeSuggestion}
              filteredSuggestions={filteredSuggestions}
              showSuggestions={showSuggestions}
              focusCascade={focusCascade}
              onClickSuggestion={this.onClickSuggestion}
            />
          </div>
        </RCCascader>
      </div>
    )
  }
}
