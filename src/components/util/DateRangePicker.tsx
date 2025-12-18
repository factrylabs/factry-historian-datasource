import React, { useEffect, useState } from 'react'
import { DateTimePicker, Button, Input, InlineFieldRow, InlineField, useStyles2 } from '@grafana/ui'
import { DateTime, dateTime, GrafanaTheme2, TIME_FORMAT } from '@grafana/data'
import { TimeRange, labelWidth, } from 'types'
import { DataSource } from 'datasource'
import { css } from '@emotion/css'

// Using grafana date picker but faking our own input since the 9+ version doesn't accept empty values.
// @todo Use the new date picker when we set grafana v11.4 as the mimimum version

interface Props {
  datasource: DataSource
  dateTimeRange: TimeRange
  override?: boolean
  onChange: (value: TimeRange) => void
}

export const DateRangePicker: React.FC<Props> = ({ datasource, dateTimeRange, override, onChange }) => {
  const [currentRange, setCurrentRange] = useState<TimeRange>(dateTimeRange)
  const [fromInput, setFromInput] = useState(currentRange.from ?? '')
  const [toInput, setToInput] = useState(currentRange.to ?? '')
  const styles = useStyles2(getStyles)

  useEffect(() => {
    if (dateTimeRange.from) {
      setFromInput(
        datasource.containsTemplate(dateTimeRange.from)
          ? dateTimeRange.from
          : isValidDateString(dateTimeRange.from)
            ? dateTime(dateTimeRange.from).format(TIME_FORMAT)
            : ''
      )
    }
    if (dateTimeRange.to) {
      setToInput(
        datasource.containsTemplate(dateTimeRange.to)
          ? dateTimeRange.to
          : isValidDateString(dateTimeRange.to)
            ? dateTime(dateTimeRange.to).format(TIME_FORMAT)
            : ''
      )
    }

  }, [dateTimeRange.from, dateTimeRange.to, datasource])

  const handleFromInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromInput(e.currentTarget.value)
  }

  const handleToInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToInput(e.currentTarget.value)
  }

  const handleFromInputBlur = (value = fromInput) => {
    let parsed: string | null

    if (!value || value === 'null') {
      parsed = null
    } else if (datasource.containsTemplate(value)) {
      parsed = value
    } else {
      const dt = dateTime(value)
      parsed = dt.isValid() ? dt.toISOString() : null
      if (dateTimeRange.toParsed && dateTime(dateTimeRange.toParsed).isBefore(dt)) {
        parsed = dateTime(dateTimeRange.toParsed).toISOString()
      }
    }

    const updated = { ...currentRange, from: parsed }
    setCurrentRange(updated)
    onChange(updated)
  }

  const handleToInputBlur = (value = toInput) => {
    let parsed: string | null

    if (!value || value === 'null') {
      parsed = null
    } else if (datasource.containsTemplate(value)) {
      parsed = value
    } else {
      const dt = dateTime(value)
      parsed = dt.isValid() ? dt.toISOString() : null
      if (dateTimeRange.fromParsed && dt.isBefore(dateTime(dateTimeRange.fromParsed))) {
        parsed = dateTime(dateTimeRange.fromParsed).toISOString()
      }
    }
    const updated = { ...currentRange, to: parsed }
    setCurrentRange(updated)
    onChange(updated)
  }

  const handleFromDatepickerChange = (date: DateTime | undefined) => {
    if (!date) {
      return;
    }
    const formatted = date.format(TIME_FORMAT)
    setFromInput(formatted)
    const parsedTimeRange = { ...currentRange, from: date.toISOString() }
    setCurrentRange(parsedTimeRange)
    onChange(parsedTimeRange)
  }

  const handleToDatepickerChange = (date: DateTime | undefined) => {
    if (!date) {
      return;
    }
    const formatted = date.format(TIME_FORMAT)
    setToInput(formatted)
    const parsedTimeRange = { ...currentRange, to: date.toISOString() }
    setCurrentRange(parsedTimeRange)
    onChange(parsedTimeRange)
  }

  const isValidDateString = (value: string): boolean => {
    const date = new Date(value)
    return !isNaN(date.getTime())
  }

  return (
    <>
      <InlineFieldRow className={styles.dateRangePicker}>
        <InlineField label="From" labelWidth={labelWidth}>
          <div className={styles.dateRangePicker}>
            <div className={styles.dateRangeField}>
              <Input
                value={fromInput}
                disabled={!override}
                onChange={handleFromInputChange}
                onBlur={() => handleFromInputBlur()}
              />
              <DateTimePicker
                date={dateTime(dateTimeRange.fromParsed)}
                onChange={handleFromDatepickerChange}
                maxDate={new Date(dateTimeRange.toParsed ?? '')}
              />
              <Button
                variant='secondary'
                size='sm'
                onClick={() => {
                  setFromInput('')
                  handleFromInputBlur('')
                }}
              >x</Button>
            </div>
          </div>
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow className={styles.dateRangePicker}>
        <InlineField label="To" labelWidth={labelWidth}>
          <div className={styles.dateRangePicker}>

            <div className={styles.dateRangeField}>
              <Input
                value={toInput}
                disabled={!override}
                onChange={handleToInputChange}
                onBlur={() => handleToInputBlur()}
              />
              <DateTimePicker
                date={dateTime(dateTimeRange.toParsed)}
                onChange={handleToDatepickerChange}
              />
              <Button
                variant='secondary'
                size='sm'
                onClick={() => {
                  setToInput('')
                  handleToInputBlur('')
                }}
              >x</Button>
            </div>
          </div>
        </InlineField>
      </InlineFieldRow>
    </>
  )
}

const getStyles = (_: GrafanaTheme2) => ({
  dateRangeField: css({
    display: 'flex',
    flexDirection: 'row',
    'div[data-testid="date-time-picker"]': {
      width: '2.5rem',
    },
    'div[data-testid="date-time-picker"] div[data-testid="input-wrapper"] div:first-child': {
      visibility: 'hidden',
      width: 0,
      marginLeft: '-1px',
    },
  }),
  dateRangePicker: css({
    'label': {
      display: 'block',
      textAlign: 'right',
    },
    'button': {
      height: '32px',
    },
  }),
});
