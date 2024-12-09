package util

import (
	"encoding/json"

	"maps"
	"slices"
)

// PeriodicPropertyValues is a map of offsets and values
type PeriodicPropertyValues struct {
	ValuesByOffset          map[float64]interface{} `json:"-"`
	DimensionValuesByOffset map[float64]interface{} `json:"-"`
}

// NewPeriodicPropertyValues creates a new PeriodicPropertyValues
func NewPeriodicPropertyValues() *PeriodicPropertyValues {
	return &PeriodicPropertyValues{
		ValuesByOffset: map[float64]interface{}{},
	}
}

// NewPeriodicPropertyValuesWithDimension creates a new PeriodicPropertyValues with dimension values
func NewPeriodicPropertyValuesWithDimension() *PeriodicPropertyValues {
	return &PeriodicPropertyValues{
		ValuesByOffset:          map[float64]interface{}{},
		DimensionValuesByOffset: map[float64]interface{}{},
	}
}

// HasDimensionValues returns true if the values have dimension values
func (p *PeriodicPropertyValues) HasDimensionValues() bool {
	return p.DimensionValuesByOffset != nil
}

// GetValueAt returns the value at the given offset
func (p *PeriodicPropertyValues) GetValueAt(offset float64) interface{} {
	return p.ValuesByOffset[offset]
}

// GetDimensionValueAt returns the dimension value at the given offset
func (p *PeriodicPropertyValues) GetDimensionValueAt(offset float64) interface{} {
	if p.DimensionValuesByOffset == nil {
		return nil
	}

	return p.DimensionValuesByOffset[offset]
}

// SetValueAt sets the value at the given offset
func (p *PeriodicPropertyValues) SetValueAt(offset float64, value interface{}) {
	p.ValuesByOffset[offset] = value
	if p.DimensionValuesByOffset != nil {
		p.DimensionValuesByOffset[offset] = nil
	}
}

// SetDimensionValueAt sets the dimension value at the given offset
func (p *PeriodicPropertyValues) SetDimensionValueAt(offset float64, values interface{}) {
	if p.DimensionValuesByOffset == nil {
		return
	}

	p.DimensionValuesByOffset[offset] = values
	p.ValuesByOffset[offset] = nil
}

// AppendValue appends a value to the end of the values
func (p *PeriodicPropertyValues) AppendValue(offset float64, value interface{}) {
	if p.DimensionValuesByOffset != nil {
		p.DimensionValuesByOffset[offset] = nil
	}

	p.ValuesByOffset[offset] = value
}

// RemoveValueAt removes a value at the given offset
func (p *PeriodicPropertyValues) RemoveValueAt(offset float64) {
	delete(p.ValuesByOffset, offset)
	if p.DimensionValuesByOffset != nil {
		delete(p.DimensionValuesByOffset, offset)
	}
}

// SetValueAtWithDimension sets the value at the given offset with a unit value
func (p *PeriodicPropertyValues) SetValueAtWithDimension(offset float64, value interface{}, unitValue interface{}) {
	if p.DimensionValuesByOffset == nil {
		return
	}

	p.ValuesByOffset[offset] = value
	p.DimensionValuesByOffset[offset] = unitValue
}

// AppendValueWithDimension appends a value to the end of the values with a unit value
func (p *PeriodicPropertyValues) AppendValueWithDimension(offset float64, value interface{}, unitValue interface{}) {
	p.SetValueAtWithDimension(offset, value, unitValue)
}

type periodicPropertyValuesJSON struct {
	Offsets         []float64     `json:"t"`
	Values          []interface{} `json:"v"`
	DimensionValues []interface{} `json:"d,omitempty"`
}

// MarshalJSON marshals the PeriodicPropertyValues to JSON
func (p *PeriodicPropertyValues) MarshalJSON() ([]byte, error) {
	t := make([]float64, 0, len(p.ValuesByOffset))
	v := make([]interface{}, 0, len(p.ValuesByOffset))
	var d []interface{}
	if p.DimensionValuesByOffset != nil {
		d = make([]interface{}, 0, len(p.ValuesByOffset))
	}

	// Sort the offsets
	offsets := slices.Sorted(maps.Keys(p.ValuesByOffset))

	for _, offset := range offsets {
		t = append(t, offset)
		v = append(v, p.ValuesByOffset[offset])
		if p.DimensionValuesByOffset != nil {
			d = append(d, p.DimensionValuesByOffset[offset])
		}
	}

	result := periodicPropertyValuesJSON{
		Offsets: t,
		Values:  v,
	}

	if p.DimensionValuesByOffset != nil {
		result.DimensionValues = d
	}

	return json.Marshal(result)
}

// ParseValues parses the values in the PeriodicPropertyValues
func (p *PeriodicPropertyValues) ParseValues(parser func(interface{}) (interface{}, error)) error {
	values := make(map[float64]interface{})

	for offset, value := range p.ValuesByOffset {
		parsedValue, err := parser(value)
		if err != nil {
			return err
		}

		values[offset] = parsedValue
	}

	p.ValuesByOffset = values

	return nil
}

// UnmarshalJSON unmarshals the PeriodicPropertyValues from JSON
func (p *PeriodicPropertyValues) UnmarshalJSON(data []byte) error {
	v := periodicPropertyValuesJSON{}

	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}

	p.ValuesByOffset = map[float64]interface{}{}

	if v.DimensionValues != nil {
		p.DimensionValuesByOffset = map[float64]interface{}{}
	}

	for i := range v.Offsets {
		p.ValuesByOffset[v.Offsets[i]] = v.Values[i]
		if len(v.DimensionValues) > i {
			p.DimensionValuesByOffset[v.Offsets[i]] = v.DimensionValues[i]
		}
	}

	return nil
}
