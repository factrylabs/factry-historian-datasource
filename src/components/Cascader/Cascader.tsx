import { css } from '@emotion/css'
import memoizeOne from 'memoize-one'
import RCCascader from 'rc-cascader'
import React, { PureComponent } from 'react'

import { SelectableValue } from '@grafana/data'

import { Icon, Input, Themeable2, withTheme2 } from '@grafana/ui'

import { onChangeCascader, onLoadDataCascader } from './optionMappings'
import { Autocomplete } from '../Autocomplete/Autocomplete'
import { findOption } from 'QueryEditor/util'

import { getCascaderStyles } from './styles'

export interface CascaderProps extends Themeable2 {
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
  // When cascader is opened
  onOpen?: () => void
  /** When mounted focus automatically on the input */
  autoFocus?: boolean
  /** Keep the dropdown open all the time, useful in case whole cascader visibility is controlled by the parent */
  alwaysOpen?: boolean
  /** Don't show what is selected in the cascader input/search. Useful when input is used just as search and the
      cascader is hidden after selection. */
  hideActiveLevelLabel?: boolean
  /** Callback to lazily load children when a node is expanded */
  loadData?: (selectOptions: CascaderOption[]) => void
  /** Callback for API-driven search-as-you-type. When provided, replaces local filtering. */
  onSearchAsync?: (keyword: string) => Promise<Array<SelectableValue<string[]>>>
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
  searchResults: Array<SelectableValue<string[]>>
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
  /** When true, the node cannot be expanded (no expand arrow). Used for lazy loading. */
  isLeaf?: boolean
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
      searchResults: [],
    }
  }

  static defaultProps = { changeOnSelect: true }

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

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
    const userInput: string = e.target.value

    this.setState({
      activeLabel: userInput,
      focusCascade: userInput.length === 0,
    })
    this.props.onSelect(userInput)

    if (this.props.onSearchAsync) {
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer)
      }
      if (userInput.length < 2) {
        this.setState({ showSuggestions: false, filteredSuggestions: [], searchResults: [] })
        return
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.props.onSearchAsync!(userInput).then((results) => {
          this.setState({
            showSuggestions: true,
            filteredSuggestions: results.map((r) => r.label || ''),
            searchResults: results,
          })
        })
      }, 300)
    } else {
      const suggestions: string[] = this.getSearchableOptions(this.props.options).map((e) => e.label || '')
      const filteredSuggestions: string[] = suggestions.filter(
        (suggestion) => suggestion.toLowerCase().indexOf(userInput.toLowerCase()) > -1
      )
      this.setState({
        showSuggestions: true,
        filteredSuggestions: filteredSuggestions,
      })
    }
  }

  onClickSuggestion = (e: any) => {
    const clickedLabel = e.currentTarget.innerText
    if (this.props.onSearchAsync && this.state.searchResults.length > 0) {
      const result = this.state.searchResults.find((r) => r.label === clickedLabel)
      if (result && result.value && result.value.length > 0) {
        if (result.value.length >= 2) {
          this.props.onSelect(result.value[result.value.length - 2], result.value[result.value.length - 1])
        } else {
          this.props.onSelect(result.value[result.value.length - 1])
        }
      }
      let displayLabel = clickedLabel.replace(new RegExp('📦 ', 'g'), '').replace(new RegExp('📏 ', 'g'), '')
      // When a property is selected, show only the asset path
      if (result && result.value && result.value.length >= 2 && result.description) {
        displayLabel = result.description
      }
      this.setState({
        activeSuggestion: 0,
        filteredSuggestions: [],
        showSuggestions: false,
        activeLabel: displayLabel,
        searchResults: [],
      })
      return
    }

    const option = findOption(this.getSearchableOptions(this.props.options), clickedLabel)
    let activeLabel: string = option?.label || clickedLabel
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
      if (this.props.onSearchAsync && this.state.searchResults.length > 0) {
        const result = this.state.searchResults[activeSuggestion]
        if (result && result.value && result.value.length > 0) {
          if (result.value.length >= 2) {
            this.props.onSelect(result.value[result.value.length - 2], result.value[result.value.length - 1])
          } else {
            this.props.onSelect(result.value[result.value.length - 1])
          }
        }
        let displayLabel = (result?.label || filteredSuggestions[activeSuggestion] || '')
          .replace(new RegExp('📦 ', 'g'), '').replace(new RegExp('📏 ', 'g'), '')
        if (result && result.value && result.value.length >= 2 && result.description) {
          displayLabel = result.description
        }
        this.setState({
          activeSuggestion: 0,
          showSuggestions: false,
          activeLabel: displayLabel,
          searchResults: [],
        })
        return
      }

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
    this.props.onOpen?.()
  }

  render() {
    const { placeholder, width, changeOnSelect, options } = this.props
    const { focusCascade, rcValue, activeLabel, activeSuggestion, filteredSuggestions, showSuggestions } = this.state
    const { theme } = this.props
    const styles = getCascaderStyles(theme)

    this.getSearchableOptions(options)

    return (
      <>
        <RCCascader
          onChange={onChangeCascader(this.onChange)}
          options={options}
          changeOnSelect={changeOnSelect}
          value={rcValue.value}
          fieldNames={{ label: 'label', value: 'value', children: 'items' }}
          expandIcon={null}
          open={focusCascade}
          dropdownClassName={styles.dropdown}
          loadData={this.props.loadData ? onLoadDataCascader(this.props.loadData) : undefined}
          allowClear
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
      </>
    )
  }
}
export default withTheme2(Cascader)
