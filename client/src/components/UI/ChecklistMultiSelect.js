import React from 'react';
import Select from 'react-select';

const selectStyles = {
    control: (base, state) => ({
        ...base,
        borderColor: state.isFocused ? '#C50B34' : '#D1D5DB',
        boxShadow: state.isFocused ? '0 0 0 2px rgba(197,11,52,0.2)' : 'none',
        '&:hover': { borderColor: '#C50B34' },
        minHeight: '38px',
        fontSize: '14px',
    }),
    multiValue: (base) => ({ ...base, backgroundColor: '#fde8ed' }),
    multiValueLabel: (base) => ({ ...base, color: '#C50B34', fontSize: '12px' }),
    multiValueRemove: (base) => ({
        ...base,
        color: '#C50B34',
        '&:hover': { backgroundColor: '#C50B34', color: 'white' },
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#C50B34' : state.isFocused ? '#fde8ed' : 'white',
        color: state.isSelected ? 'white' : '#374151',
        fontSize: '13px',
    }),
    placeholder: (base) => ({ ...base, fontSize: '13px', color: '#9CA3AF' }),
};

/**
 * ChecklistMultiSelect
 *
 * Props:
 *   options       – array of { value, label }
 *   value         – array of selected ids
 *   onChange      – (ids: number[]) => void
 *   label         – string (default "Checklists")
 *   placeholder   – string (default "All checklists...")
 */
const ChecklistMultiSelect = ({
    options = [],
    value = [],
    onChange,
    label = 'Checklists',
    placeholder = 'All checklists...',
}) => {
    const selected = options.filter(o => value.includes(o.value));

    return (
        <div>
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            )}
            <Select
                isMulti
                options={options}
                value={selected}
                onChange={sel => onChange(sel.map(s => s.value))}
                styles={selectStyles}
                placeholder={placeholder}
                closeMenuOnSelect={false}
                noOptionsMessage={() => 'No checklists available'}
            />
        </div>
    );
};

export default ChecklistMultiSelect;
