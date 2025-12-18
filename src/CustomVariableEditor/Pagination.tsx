import { InlineField, InlineFieldRow, Input } from '@grafana/ui'
import React, { useState } from 'react'
import { labelWidth, Pagination as PaginationType } from 'types'

export interface PaginationProps {
  onChange: (value: PaginationType) => void
  initialValue?: PaginationType
  tooltipText?: string
}

export function Pagination (props: PaginationProps) {
  const [inputLimit, setInputLimit] = useState<string>(String(props.initialValue?.Limit ?? ''))

  const onLimitChange = (event: React.FocusEvent<HTMLInputElement, Element>) => {
    const value = event.currentTarget.value
    setInputLimit(value)
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > 0) {
      props.onChange({ ...props.initialValue, Limit: parsed, Page: 0 })
    }
  }

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label={'Max values'}
          aria-label={'Max values'}
          labelWidth={labelWidth}
          tooltip={props.tooltipText ?? 'Maximum amount of values to fetch'}
        >
          <Input
            type="number"
            min="1"
            placeholder="100"
            value={inputLimit}
            onChange={(e) => setInputLimit(e.currentTarget.value)}
            onBlur={onLimitChange}
          />
        </InlineField>
      </InlineFieldRow>
    </>
  )
}
