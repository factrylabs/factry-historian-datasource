package util

import (
	"golang.org/x/exp/slices"
)

// PeriodicPropertyValues is a map of offsets and values
type PeriodicPropertyValues struct {
	// Offsets is a list of offsets
	Offsets []float64 `json:"t"`
	// Values is a list of values
	Values []interface{} `json:"v"`
}

// GetValueAt returns the value at the given offset
func (p *PeriodicPropertyValues) GetValueAt(offset float64) interface{} {
	index := slices.Index(p.Offsets, offset)
	if index == -1 {
		return nil
	}

	return p.Values[index]
}

// SetValueAt sets the value at the given offset
func (p *PeriodicPropertyValues) SetValueAt(offset float64, value interface{}) {
	index := slices.Index(p.Offsets, offset)
	if index == -1 {
		p.Offsets = append(p.Offsets, offset)
		p.Values = append(p.Values, value)
		return
	}

	p.Values[index] = value
}

// AppendValue appends a value to the end of the values
func (p *PeriodicPropertyValues) AppendValue(offset float64, value interface{}) {
	p.Offsets = append(p.Offsets, offset)
	p.Values = append(p.Values, value)
}

// RemoveValueAt removes a value at the given offset
func (p *PeriodicPropertyValues) RemoveValueAt(offset float64) {
	index := slices.Index(p.Offsets, offset)
	if index == -1 {
		return
	}

	p.Offsets = append(p.Offsets[:index], p.Offsets[index+1:]...)
	p.Values = append(p.Values[:index], p.Values[index+1:]...)
}

// Sort sorts the values by offset
func (p *PeriodicPropertyValues) Sort() {
	mapped := make(map[float64]interface{})
	for i, offset := range p.Offsets {
		mapped[offset] = p.Values[i]
	}

	sortedValues := make([]interface{}, len(p.Offsets))
	slices.Sort(p.Offsets)
	for i, offset := range p.Offsets {
		sortedValues[i] = mapped[offset]
	}

	p.Values = sortedValues
}
