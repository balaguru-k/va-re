import React from 'react';
import { DemoContainer } from '@mui/x-date-pickers/internals/demo';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';

export default function BasicTimePicker({ value, onChange, error }) {
  const timeValue = value ? dayjs(value, 'HH:mm') : null;
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Alert Time *</label>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <TimePicker 
          value={timeValue}
          onChange={(newValue) => {
            if (newValue && newValue.isValid()) {
              onChange(newValue.format('HH:mm'));
            } else {
              onChange('');
            }
          }}
          className="w-full"
          sx={{
            '& .css-vycme6-MuiPickersInputBase-root-MuiPickersOutlinedInput-root': {
              textAlign: 'center !important',
            },
            '& .css-lqwr9g-MuiPickersOutlinedInput-notchedOutline': {
              height: '40px !important',
              borderColor: '#d1d5db !important',
              borderWidth: '1px !important',
            },
            '& .MuiPickersSectionList-root.MuiPickersInputBase-sectionsContainer.css-1y4gq5a-MuiPickersSectionList-root-MuiPickersInputBase-sectionsContainer-MuiPickersOutlinedInput-sectionsContainer': {
              marginTop: '-8px !important',
            },
            '& .MuiPickersSectionList-root.MuiPickersInputBase-sectionsContainer.css-1fb7els-MuiPickersSectionList-root-MuiPickersInputBase-sectionsContainer-MuiPickersOutlinedInput-sectionsContainer': {
              marginTop: '-8px !important',
            },
            '& button.MuiButtonBase-root.MuiIconButton-root.MuiIconButton-edgeEnd.MuiIconButton-sizeMedium.css-1ysp02-MuiButtonBase-root-MuiIconButton-root': {
              marginTop: '-8px !important',
            },
          }}
        />
      </LocalizationProvider>
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}