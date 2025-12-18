import React, { ChangeEvent, FormEvent, useState } from 'react'
import { Input, Tooltip } from '@grafana/ui'
import { isRegex, isValidRegex } from 'util/util'

export interface MaybeRegexInputProps {
  onChange: (val: string, valid: boolean) => void
  initialValue?: string
  placeHolder?: string
  width?: number
}

export function MaybeRegexInput (props: MaybeRegexInputProps) {
  const [error, setError] = useState<string | undefined>()

  const onChange = (event: FormEvent<HTMLInputElement>) => {
    const keyword = (event as ChangeEvent<HTMLInputElement>).target.value as string
    let valid = false
    if (isRegex(keyword)) {
      if (isValidRegex(keyword)) {
        setError(undefined)
        valid = true
      } else {
        setError('Invalid regex')
      }
    } else {
      setError(undefined)
      valid = true
    }

    props.onChange(keyword, valid)
  }

  return (
    <Tooltip
      content={() => <>{error}</>}
      theme="error"
      placement="right"
      show={error !== undefined}
      interactive={false}
    >
      <Input value={props.initialValue} onChange={(e) => onChange(e)} width={props.width} />
    </Tooltip>
  )
}
