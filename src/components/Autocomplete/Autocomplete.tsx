// based on https://www.digitalocean.com/community/tutorials/react-react-autocomplete
import { css } from '@emotion/css'
import React from 'react'

import { GrafanaTheme2 } from '@grafana/data'
import { useStyles2 } from '@grafana/ui'

export interface Props {
  showSuggestions: boolean
  activeLabel: string
  filteredSuggestions: string[]
  activeSuggestion: number
  focusCascade: boolean
  onClickSuggestion: (e: any) => void
}

export const Autocomplete = ({ showSuggestions, activeLabel, filteredSuggestions, activeSuggestion, focusCascade, onClickSuggestion }: Props): JSX.Element | null => {
  const styles = useStyles2(getStyles);
  let suggestionsListComponent = null
  if (showSuggestions && activeLabel && !focusCascade) {
    if (filteredSuggestions.length) {
      suggestionsListComponent = (
        <ul className={styles.container}>
          {filteredSuggestions.map((suggestion, index) => {
            let className = styles.option;

            // Flag the active suggestion with a class
            if (index === activeSuggestion) {
              className += " " + styles.optionSelected
            }
            return (
              <li className={className} key={suggestion} onClick={onClickSuggestion}>
                {suggestion}
              </li>
            )
          })}
        </ul>
      );
    }
  }

  return suggestionsListComponent
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.secondary};
      min-width: 350px;
      border-radius: ${theme.shape.borderRadius(2)};
      margin-bottom: ${theme.spacing(4)};
      list-style: none;
    `,
    no_suggestions: css`
      background-color: ${theme.colors.background.secondary};
      min-width: 350px;
      border-radius: ${theme.shape.borderRadius(2)};
      margin-bottom: ${theme.spacing(4)};
      color: #999;
      padding: 0.5rem;
    `,
    option: css`
      label: grafana-select-option;
      padding: 8px;
      display: flex;
      align-items: center;
      flex-direction: row;
      flex-shrink: 0;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
      &:hover {
        background: ${theme.colors.action.hover};
      }
    `,
    optionSelected: css`
      background: ${theme.colors.action.selected};
    `,
  }
}
