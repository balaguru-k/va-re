import { useState } from 'react';
import toast from 'react-hot-toast';

// User-friendly error messages mapping
const getErrorMessage = (error, defaultMessage) => {
  const serverMessage = error.response?.data?.error || error.response?.data?.message || error.message;

  // Common error patterns and their user-friendly messages
  const errorMappings = {
    // Network errors
    'Network Error': 'Unable to connect to server. Please check your internet connection.',
    'timeout': 'Request timed out. Please try again.',

    // Authentication errors
    'Unauthorized': 'Your session has expired. Please log in again.',
    'Invalid token': 'Your session has expired. Please log in again.',
    'Access denied': 'You do not have permission to perform this action.',

    // Validation errors
    'required': 'Please fill in all required fields.',
    'invalid email': 'Please enter a valid email address.',
    'password': 'Password does not meet requirements.',

    // Database errors
    'duplicate': 'This item already exists. Please use a different name.',
    'not found': 'The requested item could not be found.',
    'foreign key': 'Cannot delete this item as it is being used elsewhere.',

    // File upload errors
    'file too large': 'File size is too large. Please choose a smaller file.',
    'invalid file type': 'Invalid file type. Please upload a supported file format.',
    'upload failed': 'File upload failed. Please try again.',

    // Checklist specific errors
    'checklist name': 'Please enter a valid checklist name.',
    'category required': 'Please select a category.',
    'csv format': 'Invalid CSV format. Please check your file and try again.',
    'camera count': 'Please enter a valid camera count.',

    // User assignment errors
    'auditor required': 'Please select an auditor.',
    'user not found': 'Selected user is not available.',
    'assignment exists': 'This assignment already exists for today.',
  };

  // Check if server message contains any known error patterns
  if (serverMessage) {
    const lowerMessage = serverMessage.toLowerCase();

    for (const [pattern, friendlyMessage] of Object.entries(errorMappings)) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        return friendlyMessage;
      }
    }

    // If it's a short, clean message, use it as is
    if (serverMessage.length < 100 && !serverMessage.includes('Error:') && !serverMessage.includes('Exception')) {
      return serverMessage;
    }
  }

  // Return default user-friendly message
  return defaultMessage || 'Something went wrong. Please try again.';
};

const useApi = () => {
  const [loading, setLoading] = useState(false);

  const execute = async (apiCall, options = {}) => {
    const {
      onSuccess,
      onError,
      successMessage,
      errorMessage = 'Operation failed. Please try again.',
      showLoading = true
    } = options;

    try {
      if (showLoading) setLoading(true);
      const response = await apiCall();

      if (successMessage) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(response);
      }

      return response;
    } catch (error) {
      const status = error.response?.status;
      // Don't show toast for auth errors (401/403) as they are handled by api interceptor/redirection
      if (status !== 401 && status !== 403) {
        const friendlyMessage = getErrorMessage(error, errorMessage);
        toast.error(friendlyMessage);
      }

      if (onError) {
        onError(error);
      }

      throw error;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  return { loading, execute };
};

export default useApi;