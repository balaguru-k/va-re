// Checklist utility functions and constants

export const STATUS_OPTIONS = [
  { value: '', label: 'Select Status' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No Process', label: 'No Process' },
  { value: 'Technical Issue', label: 'Technical Issue' }
];

export const Checklist_STATUS_OPTIONS = [
  { value: '', label: 'Select Status' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'No Process', label: 'No Process' },
  { value: 'Technical Issue', label: 'Technical Issue' },
  { value: 'Camera not available', label: 'Camera not available' }
];

export const CATEGORY_OPTIONS = [
  { value: 'GMP', label: 'GMP' },
  { value: 'SOP Adherence', label: 'SOP Adherence' },
  { value: 'Safety Adherence', label: 'Safety Adherence' },
  { value: 'Hygiene', label: 'Hygiene' },
  { value: 'Treatment', label: 'Treatment' },
  { value: 'Ambience', label: 'Ambience' },
  { value: 'Customer Handling', label: 'Customer Handling' },
  { value: 'Billing', label: 'Billing' },
  { value: 'Service', label: 'Service' },
  { value: 'Category Wise', label: 'Category Wise' },
  { value: '5s', label: '5s' },
  { value: 'Appearance', label: 'Appearance' },
  { value: 'Process', label: 'Process' },
  { value: 'Chit Chat', label: 'Chit Chat' },
  { value: 'COVID-19', label: 'COVID-19' },
  { value: 'Check Sheet/OKR', label: 'Check Sheet/OKR' },
  { value: 'Work Surface', label: 'Work Surface' },
  { value: 'Accessories & Instruments', label: 'Accessories & Instruments' },
  { value: 'Check list', label: 'Check list' },
  { value: 'Display', label: 'Display' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Pet Care', label: 'Pet Care' },
  { value: 'Personal hygiene', label: 'Personal hygiene' },
  { value: 'New look', label: 'New look' },
  { value: 'Register', label: 'Register' },
  { value: 'Accounts', label: 'Accounts' },
  { value: 'Stock', label: 'Stock' },
  { value: 'Equipments', label: 'Equipments' },
  { value: 'Security', label: 'Security' },
  { value: 'Customer & Stock', label: 'Customer & Stock' },
  { value: 'Grooming', label: 'Grooming' },
  { value: 'Reports', label: 'Reports' }
];


export const SUPERVISOR_REASONS = [
  { value: '', label: 'select' },
  { value: 'Process Training', label: 'Process Training' },
  { value: 'Review-Attitude', label: 'Review-Attitude' },
  { value: 'Review-Corrective action', label: 'Review-Corrective action' },
  { value: 'Other', label: 'Other' }
];

export const getCriticalityBadgeClass = (criticality) => {
  const classes = {
    'High': 'bg-red-100 text-red-800',
    'Medium': 'bg-yellow-100 text-yellow-800',
    'Low': 'bg-green-100 text-green-800',
    'New': 'bg-blue-100 text-blue-800'
  };
  return classes[criticality] || 'bg-gray-100 text-gray-800';
};

export const canViewAccordions = (userRole) => {
  return userRole !== 'Supervisor' && userRole !== 'Manager';
};

export const buildImageUrl = (imageName) => {
  return `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(imageName)}`;
};

export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getStatusBadgeClass = (status) => {
  const classes = {
    'Completed': 'bg-green-100 text-green-800',
    'Completed without NCs': 'bg-green-100 text-green-800',
    'Awaiting for NC response': 'bg-yellow-100 text-yellow-800',
    'Waiting NC Response': 'bg-yellow-100 text-yellow-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};

export const downloadImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = imageUrl.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download failed:', error);
  }
};