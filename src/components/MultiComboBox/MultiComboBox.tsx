import * as React from 'react'
import { useCombobox, useMultipleSelection, UseMultipleSelectionStateChange } from 'downshift'
import { Input, Checkbox, useTheme2 } from '@grafana/ui'
import type { SelectableValue } from '@grafana/data'

export interface MultiComboBoxProps<T = string> {
  options: Array<GroupedSelectableValue<T>>
  value: T[]
  onChange: (value: T[]) => void
  placeholder?: string
  disabled?: boolean
}

export interface GroupedSelectableValue<T = string> extends SelectableValue<T> {
  group?: string
}

export function MultiComboBox<T = string>({ options, value, onChange, placeholder, disabled }: MultiComboBoxProps<T>) {
  const theme = useTheme2()
  const [inputValue, setInputValue] = React.useState('')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const borderColor = theme.colors.border.medium
  const textColor = theme.colors.text.primary
  const bgPrimary = theme.colors.background.primary
  const bgSecondary = theme.colors.background.secondary
  const padXs = theme.spacing(0.5)
  const padSm = theme.spacing(1)
  const padMd = theme.spacing(2)
  const radiusMd = theme.shape.borderRadius(1)

  const MAX_TOTAL_ITEMS_BEFORE_SUMMARY = 8 // switch to count summary if too many items
  const MAX_PER_GROUP_ITEMS = 3 // how many labels to show per group before "…"
  const MAX_DISPLAY_CHARS = 70 // switch if the string gets too long

  const [maxDisplayChars, setMaxDisplayChars] = React.useState(MAX_DISPLAY_CHARS)

  // Close on real outside clicks
  React.useEffect(() => {
    if (!menuOpen) {
      return
    }
    const handler = (e: Event) => {
      const root = wrapperRef.current
      const target = e.target as Node | null
      if (root && target && !root.contains(target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    document.addEventListener('touchstart', handler, true)
    return () => {
      document.removeEventListener('pointerdown', handler, true)
      document.removeEventListener('touchstart', handler, true)
    }
  }, [menuOpen])

  React.useEffect(() => {
    if (!inputRef.current) {
      return
    }

    const update = () => {
      const widthPx = inputRef.current!.offsetWidth
      const avgCharPx = 7
      setMaxDisplayChars(Math.floor(widthPx / avgCharPx))
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const selectedItems: Array<GroupedSelectableValue<T>> = React.useMemo(
    () => options.filter((opt) => value.includes(opt.value as T)),
    [options, value]
  )

  const {
    addSelectedItem,
    removeSelectedItem,
    setSelectedItems,
    selectedItems: selectedDownshiftItems,
  } = useMultipleSelection<GroupedSelectableValue<T>>({
    selectedItems,
    onSelectedItemsChange: (changes: UseMultipleSelectionStateChange<GroupedSelectableValue<T>>) => {
      if (changes.selectedItems) {
        onChange(changes.selectedItems.map((item) => item.value as T))
      }
    },
  })

  // Selected values for quick lookup
  const selectedSet = React.useMemo(() => new Set<T>(value), [value])

  const upsertMany = React.useCallback(
    (items: Array<GroupedSelectableValue<T>>, shouldSelect: boolean) => {
      // Start from what Downshift thinks is selected (items, not just values)
      const byValue = new Map(selectedDownshiftItems.map((it) => [it.value as T, it]))

      if (shouldSelect) {
        // Add any missing items
        for (const it of items) {
          if (!byValue.has(it.value as T)) {
            byValue.set(it.value as T, it)
          }
        }
      } else {
        // Remove the items
        for (const it of items) {
          byValue.delete(it.value as T)
        }
      }

      // One atomic update → Downshift will call onSelectedItemsChange once
      setSelectedItems(Array.from(byValue.values()))
    },
    [selectedDownshiftItems, setSelectedItems]
  )

  const filteredItems = React.useMemo(
    () =>
      options.filter(
        (item) => !inputValue || (item.label && item.label.toString().toLowerCase().includes(inputValue.toLowerCase()))
      ),
    [options, inputValue]
  )

  const groups = React.useMemo(() => {
    const m = new Map<string, Array<GroupedSelectableValue<T>>>()
    for (const it of filteredItems) {
      const g = (it.group || '').toString()
      if (!m.has(g)) {
        m.set(g, [])
      }
      m.get(g)!.push(it)
    }
    return m
  }, [filteredItems])

  const groupState = React.useMemo(() => {
    const res = new Map<string, { total: number; selected: number }>()
    for (const [g, items] of groups) {
      let sel = 0
      for (const it of items) {
        if (selectedSet.has(it.value as T)) {
          sel++
        }
      }
      res.set(g, { total: items.length, selected: sel })
    }
    return res
  }, [groups, selectedSet])

  const { isOpen, getToggleButtonProps, getMenuProps, getInputProps, getItemProps, highlightedIndex, closeMenu } =
    useCombobox<GroupedSelectableValue<T>>({
      items: filteredItems,
      inputValue,
      selectedItem: null,
      defaultHighlightedIndex: 0,
      itemToString: () => '',
      isOpen: menuOpen, // controlled
      onInputValueChange: ({ inputValue }) => setInputValue(inputValue ?? ''),
      onStateChange: (changes) => {
        const { type } = changes
        switch (type) {
          case useCombobox.stateChangeTypes.ToggleButtonClick:
            setMenuOpen((o) => !o)
            break
          case useCombobox.stateChangeTypes.FunctionOpenMenu:
            setMenuOpen(true)
            break
          case useCombobox.stateChangeTypes.InputKeyDownEscape:
            setMenuOpen(false)
            break
          case useCombobox.stateChangeTypes.ItemClick:
          case useCombobox.stateChangeTypes.InputKeyDownEnter:
          case useCombobox.stateChangeTypes.InputChange:
          case useCombobox.stateChangeTypes.FunctionSetInputValue:
            setMenuOpen(true)
            break
          default:
            break
        }
      },
      onSelectedItemChange: (changes) => {
        if (
          changes.type !== useCombobox.stateChangeTypes.ItemClick &&
          changes.type !== useCombobox.stateChangeTypes.InputKeyDownEnter
        ) {
          return
        }
        const selectedItem = changes.selectedItem
        if (!selectedItem) {
          return
        }
        const realItem = filteredItems.find((opt) => opt.value === selectedItem.value)
        if (!realItem) {
          return
        }
        const alreadySelected = selectedDownshiftItems.some((i) => i.value === realItem.value)
        alreadySelected ? removeSelectedItem(realItem) : addSelectedItem(realItem)
        // keep open for multi-pick
      },
    })

  const displayValue = React.useMemo(() => {
    if (selectedItems.length === 0) {
      return ''
    }

    // Build groups in the order they appear in options
    const groupOrder: string[] = []
    const grouped = new Map<string, string[]>()
    for (const opt of options) {
      if (!selectedSet.has(opt.value as T)) {
        continue
      }
      const g = (opt.group || 'Other').toString()
      if (!grouped.has(g)) {
        grouped.set(g, [])
        groupOrder.push(g)
      }
      grouped.get(g)!.push(String(opt.label ?? opt.value))
    }

    // Early bail: too many items overall
    if (selectedItems.length > MAX_TOTAL_ITEMS_BEFORE_SUMMARY) {
      return `${selectedItems.length} items selected`
    }

    // Render "Group: (a, b, …)" parts
    const parts = groupOrder.map((g) => {
      const labels = grouped.get(g)!
      const shown = labels.slice(0, MAX_PER_GROUP_ITEMS)
      const more = labels.length - shown.length
      const body = more > 0 ? `${shown.join(', ')}, …` : shown.join(', ')
      return `${g}: (${body})`
    })

    const s = parts.join(', ')

    // If the string is still too long, fall back to count
    if (s.length > maxDisplayChars) {
      return `${selectedItems.length} items selected`
    }

    return s
  }, [options, selectedItems, selectedSet, maxDisplayChars])

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', minWidth: 240 }}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          if (isOpen) {
            closeMenu()
            setMenuOpen(false)
          }
        }
      }}
    >
      <Input
        {...getToggleButtonProps({
          onMouseDown: (e: React.MouseEvent) => e.preventDefault(), // avoid blur race
          placeholder: placeholder || 'Select...',
          value: displayValue,
          readOnly: true,
          disabled,
        })}
        ref={inputRef}
      />

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            top: `calc(100% + ${padXs})`,
            left: 0,
            right: 0,
            background: bgPrimary,
            border: `1px solid ${borderColor}`,
            borderRadius: radiusMd,
            boxShadow: theme.shadows.z2,
            maxHeight: 280,
            overflowY: 'auto',
            isolation: 'isolate',
          }}
        >
          <div style={{ padding: padMd, borderBottom: `1px solid ${borderColor}` }}>
            <Input
              {...getInputProps({
                placeholder: 'Search...',
                disabled,
                onChange: (e: React.FormEvent<HTMLInputElement>) => setInputValue(e.currentTarget.value),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setMenuOpen(false)
                  }
                },
              })}
            />

            {!!inputValue && filteredItems.length > 0 && (
              <div style={{ marginTop: padSm, display: 'flex', gap: padSm, fontSize: 12 }}>
                {(() => {
                  const selectedCount = filteredItems.reduce((n, it) => n + (selectedSet.has(it.value as T) ? 1 : 0), 0)
                  const allSelected = selectedCount === filteredItems.length
                  return allSelected ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        upsertMany(filteredItems, false)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Clear all results ({selectedCount})
                    </button>
                  ) : (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        upsertMany(filteredItems, true)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Select all results ({filteredItems.length - selectedCount} remaining)
                    </button>
                  )
                })()}
              </div>
            )}
          </div>

          <ul {...getMenuProps()} style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative', zIndex: 0 }}>
            {filteredItems.map((item, index) => {
              const prevGroup = index === 0 ? undefined : filteredItems[index - 1].group || ''
              const currGroup = item.group || ''
              const showHeader = currGroup && currGroup !== prevGroup

              const header = showHeader ? (
                <li
                  key={`header-${currGroup}`}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                    fontWeight: 600,
                    padding: `${padSm} ${padMd}`,
                    color: textColor,
                    background: bgSecondary,
                    borderTop: `1px solid ${borderColor}`,
                    borderBottom: `1px solid ${borderColor}`,
                    boxShadow: `0 1px 0 ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{currGroup}</span>
                  {(() => {
                    const st = groupState.get(currGroup.toString())
                    if (!st) {
                      return null
                    }
                    const allSelected = st.selected === st.total && st.total > 0
                    return allSelected ? (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation()
                          upsertMany(groups.get(currGroup.toString()) || [], false)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontWeight: 400,
                        }}
                      >
                        Clear group ({st.selected})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation()
                          upsertMany(groups.get(currGroup.toString()) || [], true)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontWeight: 400,
                        }}
                      >
                        Select all in group ({st.total - st.selected} remaining)
                      </button>
                    )
                  })()}
                </li>
              ) : null

              return (
                <React.Fragment key={String(item.value)}>
                  {header}
                  <li
                    {...getItemProps({
                      item,
                      index,
                      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                    })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: padSm,
                      padding: `${padSm} ${padMd}`,
                      background: highlightedIndex === index ? bgSecondary : bgPrimary,
                      cursor: 'pointer',
                      position: 'relative',
                      zIndex: 0,
                    }}
                  >
                    <div style={{ position: 'relative', zIndex: 0 }}>
                      <Checkbox value={selectedDownshiftItems.some((i) => i.value === item.value)} readOnly />
                    </div>
                    <span style={{ color: textColor }}>{item.label}</span>
                  </li>
                </React.Fragment>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
