import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useTimer } from '../contexts/TimerContext';
import Swal from 'sweetalert2';
import { STATUS_OPTIONS, Checklist_STATUS_OPTIONS, CATEGORY_OPTIONS, SUPERVISOR_REASONS, getCriticalityBadgeClass, canViewAccordions, buildImageUrl, formatTime } from '../utils/checklistUtils';
import { formatDate } from '../utils/dateFormatter';
import Select2Dropdown from '../components/Select2Dropdown';
import showToast from '../utils/toast';

// Simple formatter: Only first letter capitalized, rest exactly as entered
const formatChecklistName = (name) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const ChecklistForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { startTimer, stopTimer, resetTimer, getTimer } = useTimer();

  // Only Auditor, Lead-Auditor, and Super Admin can access this form
  useEffect(() => {
    if (user && !['Auditor', 'Lead-Auditor', 'Super Admin'].includes(user.role)) {
      navigate(-1);
    }
  }, [user, navigate]);
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [searchTerms, setSearchTerms] = useState({});
  const [showDropdowns, setShowDropdowns] = useState({});
  const [newItemsCount, setNewItemsCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(true);
  const [additionalFields, setAdditionalFields] = useState({
    location: '',
    department: '',
    totalCameraCount: '',
    totalCameraAudited: '',
    totalCameraRandomAudited: '',
    totalCameraNotAudited: '',
    totalCameraOffline: '',
    totalCameraOfflinePercent: '',
    totalCameraTechnicalIssues: '',
    totalCameraTechnicalIssuesPercent: '',
    totalNCs: '',
    cameraFile: null,
    remark: ''
  });
  const [previewImages, setPreviewImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [canEdit, setCanEdit] = useState(true);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [executiveData, setExecutiveData] = useState(null);
  const [executiveImageModal, setExecutiveImageModal] = useState({ show: false, images: [], currentIndex: 0 });
  const blobUrlCache = React.useRef(new Map());

  const getBlobUrl = (file) => {
    if (!(file instanceof File)) return null;
    if (!blobUrlCache.current.has(file)) {
      blobUrlCache.current.set(file, URL.createObjectURL(file));
    }
    return blobUrlCache.current.get(file);
  };

  const handleImageView = (imageSrc) => {
    setImageModal({ show: true, src: imageSrc, alt: 'Auditor Image' });
  };

  const closeImageModal = () => {
    setImageModal({ show: false, src: '', alt: '' });
  };

  const prepareFormData = () => {
    const completeFormData = { ...formData };
    items.forEach(item => {
      const itemId = item.id || items.indexOf(item);
      if (item.isNew || item.editableActivities || item.editableProcess) {
        const currentData = completeFormData[itemId] || {};
        completeFormData[itemId] = {
          ...currentData,
          activities: currentData.activities || item.activities || '',
          process: currentData.process || item.process || '',
          isNew: item.isNew || false
        };
      }
    });
    return completeFormData;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const timer = getTimer(id);
      const completeFormData = prepareFormData();
      
      // Only send truly new items (unsaved ones with 'new_' prefix IDs) to backend
      const itemsToSend = items.map(item => ({
        ...item,
        isNew: typeof item.id === 'string' && item.id.startsWith('new_')
      }));
      
      const response = await checklistAPI.saveChecklist(id, completeFormData, timer.elapsed, additionalFields, itemsToSend);
      stopTimer(id);
      await showToast('success', 'Checklist saved successfully!');
      
      navigate('/dashboard');
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };



  const handleComplete = async () => {
    try {
      setSaving(true);
      const timer = getTimer(id);
      const completeFormData = prepareFormData();
      let hasErrors = false;
      const newErrors = {};

      // Skip camera field validation for SC checklists
      if (checklist?.type !== 'SC') {
        // Validate mandatory camera fields
        const mandatoryFields = {
          totalCameraAudited: 'Total Camera Audited',
          totalCameraRandomAudited: 'Total Camera Random Audited',
          totalCameraOffline: 'Total Camera Offline',
          totalCameraTechnicalIssues: 'Total Camera Technical Issues'
        };

        const missingFields = [];
        Object.entries(mandatoryFields).forEach(([field, label]) => {
          const value = additionalFields[field];
          if (value === '' || value === null || value === undefined) {
            missingFields.push(label);
          }
        });

        if (missingFields.length > 0) {
          Swal.fire({
            icon: 'warning',
            title: 'Required Fields Missing!',
            text: `Please fill the following mandatory fields: ${missingFields.join(', ')}`
          });
          setSaving(false);
          return;
        }

        // Validate camera count - NEW VALIDATION
        const totalCameraCount = parseInt(additionalFields.totalCameraCount) || 0;
        const totalCameraAudited = parseInt(additionalFields.totalCameraAudited) || 0;
        const totalCameraRandomAudited = parseInt(additionalFields.totalCameraRandomAudited) || 0;
        const totalCameraNotAudited = parseInt(additionalFields.totalCameraNotAudited) || 0;
        const totalCameraOffline = parseInt(additionalFields.totalCameraOffline) || 0;
        const totalCameraTechnicalIssues = parseInt(additionalFields.totalCameraTechnicalIssues) || 0;

        // Validation 1: Total Camera Count = Audited + Not Audited
        const sumTotal = totalCameraAudited + totalCameraNotAudited;
        if (totalCameraCount > 0 && totalCameraCount !== sumTotal) {
          Swal.fire({
            icon: 'warning',
            title: 'Camera Count Validation Error!',
            text: `Total Camera Count (${totalCameraCount}) must equal Audited (${totalCameraAudited}) + Not Audited (${totalCameraNotAudited}) = ${sumTotal}`
          });
          setSaving(false);
          return;
        }

        // Validation 2: Not Audited = Random Audited + Offline + Technical Issues
        const sumNotAudited = totalCameraRandomAudited + totalCameraOffline + totalCameraTechnicalIssues;
        if (totalCameraNotAudited > 0 && totalCameraNotAudited !== sumNotAudited) {
          Swal.fire({
            icon: 'warning',
            title: 'Not Audited Validation Error!',
            text: `Total Camera Not Audited (${totalCameraNotAudited}) must equal Random Audited (${totalCameraRandomAudited}) + Offline (${totalCameraOffline}) + Technical Issues (${totalCameraTechnicalIssues}) = ${sumNotAudited}`
          });
          setSaving(false);
          return;
        }

        const totalCount = totalCameraAudited + totalCameraRandomAudited + totalCameraOffline + totalCameraTechnicalIssues;
        if (totalCount > 0 && totalCameraCount !== totalCount) {
          Swal.fire({
            icon: 'warning',
            title: 'Total Audited Validation Error!',
            text: `Total Camera Count (${totalCount}) must equal to Audited Count`
          });
          setSaving(false);
          return;
        }
      }
      

      items.forEach(item => {
        const itemId = item.id || items.indexOf(item);
        const itemData = completeFormData[itemId] || {};
        const errors = validateItem(itemId, itemData);
        if (Object.keys(errors).length > 0) {
          newErrors[itemId] = errors;
          hasErrors = true;
        }
      });

      if (hasErrors) {
        setValidationErrors(newErrors);
        showToast('warning', 'Please fill all required fields. All items must have a status, and items with "No" status must have a reason and either an image or text field.');
        setSaving(false);
        return;
      }
      // Only send truly new items (unsaved ones with 'new_' prefix IDs) to backend
      const itemsToSend = items.map(item => ({
        ...item,
        isNew: typeof item.id === 'string' && item.id.startsWith('new_')
      }));
      const response = await checklistAPI.completeChecklist(id, completeFormData, timer.elapsed, additionalFields, itemsToSend);
      
      // console.log('2. Server response:', JSON.stringify(response, null, 2));
      
      stopTimer(id);
      resetTimer(id);
      showToast('success', 'Checklist completed successfully!');
      
      // Fetch to see what was stored
      // console.log('3. Fetching completed data to verify storage...');
      const checklistResponse = await checklistAPI.getChecklist(id);
      // console.log('4. What was stored/fetched (checklist):', JSON.stringify(checklistResponse.data, null, 2));
      
      const itemsResponse = await checklistAPI.getChecklistItems(id);
      // console.log('5. What was stored/fetched (items):', JSON.stringify(itemsResponse.data, null, 2));
      
      try {
        const responsesResponse = await checklistAPI.getChecklistResponses(id);
        // console.log('6. What was stored/fetched (responses):', JSON.stringify(responsesResponse.data, null, 2));
      } catch (err) {
        // console.log('6. No responses found after completion');
      }
      
      navigate(user?.role === 'Lead-Auditor' ? '/dashboard' : '/checklist-data');
    } catch (error) {
      // console.error('Complete error:', error);
      showToast('error', error.response?.data?.error || error.message || 'Failed to complete checklist');
    } finally {
      setSaving(false);
    }
  };

  const addNewItems = () => {
    const newItems = [];
    const existingNewItems = items.filter(item => item.isNew).length;

    for (let i = 0; i < newItemsCount; i++) {
      newItems.push({
        id: `new_${existingNewItems + i + 1}`,
        type: '',
        activities: '',
        process: '',
        criticality: '',
        isNew: true
      });
    }

    setItems(prev => [...prev, ...newItems]);
    setNewItemsCount(1);
  };

  const deleteNewItem = async (itemId) => {
    // If it's a saved item (numeric ID), call backend to delete
    if (typeof itemId === 'number' || (typeof itemId === 'string' && !itemId.startsWith('new_'))) {
      try {
        await checklistAPI.deleteChecklistItem(itemId);
        showToast('success', 'Item deleted successfully');
      } catch (error) {
        showToast('error', 'Failed to delete item');
        return;
      }
    }
    setItems(prev => prev.filter(item => (item.id || items.indexOf(item)) !== itemId));
    setFormData(prev => {
      const newData = { ...prev };
      delete newData[itemId];
      return newData;
    });
  };

  const validateItem = (itemId, itemData) => {
    const errors = {};

    // Check if status is filled
    if (!itemData.status || itemData.status.trim() === '') {
      errors.status = 'Status is required for all items';
    }

    // Additional validation for 'No' status
    if (itemData.status === 'No') {
      if (!itemData.category || itemData.category.trim() === '') {
        errors.category = 'Category is required when status is No';
      }
      if (!itemData.reason || itemData.reason.trim() === '') {
        errors.reason = 'Reason is required when status is No';
      }
      const hasImage = itemData.images && itemData.images.length > 0;
      const hasTextbox = itemData.textbox && itemData.textbox.trim() !== '';
      if (!hasImage && !hasTextbox) {
        errors.images = 'Image or text field is required when status is No';
        errors.textbox = 'Image or text field is required when status is No';
      }
    }
    return errors;
  };



  const handleSelectAll = (status) => {
    if (!status) return;

    const newFormData = {};
    items.forEach(item => {
      const itemId = item.id || items.indexOf(item);
      newFormData[itemId] = {
        ...formData[itemId],
        status: status,
        category: status === 'No' ? formData[itemId]?.category || '' : '',
        reason: formData[itemId]?.reason || '',
        images: formData[itemId]?.images || []
      };
    });
    setFormData(newFormData);
    setValidationErrors({});
  };

  const handleCheckboxChange = (itemId, checked) => {
    const newData = {
      ...formData[itemId],
      status: checked ? 'Yes' : '',
      category: '',
      reason: '',
      images: formData[itemId]?.images || []
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));
  };

  const handleStatusChange = (itemId, status) => {
    const newData = {
      ...formData[itemId],
      status,
      category: status === 'No' ? formData[itemId]?.category || '' : '',
      reason: formData[itemId]?.reason || '',
      images: formData[itemId]?.images || []
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));

    // Clear validation errors when status changes
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[itemId];
      return newErrors;
    });
  };

  const handleCategoryChange = (itemId, category) => {
    const newData = {
      ...formData[itemId],
      category
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));

    // Clear validation error for category when changed
    setValidationErrors(prev => {
      if (prev[itemId]) {
        const { category: _, ...rest } = prev[itemId];
        return { ...prev, [itemId]: rest };
      }
      return prev;
    });
  };

  const handleSearchChange = (itemId, searchTerm) => {
    setSearchTerms(prev => ({ ...prev, [itemId]: searchTerm }));
    setShowDropdowns(prev => ({ ...prev, [itemId]: true }));

    const newData = {
      ...formData[itemId],
      category: searchTerm
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));
  };

  const getFilteredOptions = (itemId) => {
    return CATEGORY_OPTIONS.filter(option =>
      <option key={option.value} value={option.value}>{option.label}</option>
    );
  };

  const handleTextboxChange = (itemId, value) => {
    setFormData(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], textbox: value }
    }));
  };

  const handleReasonChange = (itemId, reason) => {
    const newData = {
      ...formData[itemId],
      reason
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));

    // Clear validation error for reason when changed
    setValidationErrors(prev => {
      if (prev[itemId]) {
        const { reason: _, ...rest } = prev[itemId];
        return { ...prev, [itemId]: rest };
      }
      return prev;
    });
  };

  const handleImageUpload = (itemId, files) => {
    const sanitizedFiles = Array.from(files).map(file => {
      // Sanitize filename by removing special characters
      const sanitizedName = file.name.replace(/[#$%&*+,/:;<=>?@[\]^`{|}~]/g, '_');
      return new File([file], sanitizedName, { type: file.type });
    });

    const newData = {
      ...formData[itemId],
      images: [...(formData[itemId]?.images || []), ...sanitizedFiles]
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));

    // Clear validation error for images when uploaded
    setValidationErrors(prev => {
      if (prev[itemId]) {
        const { images: _, textbox: __, ...rest } = prev[itemId];
        return { ...prev, [itemId]: rest };
      }
      return prev;
    });
  };

  const removeImage = (itemId, imageIndex) => {
    const removed = formData[itemId]?.images?.[imageIndex];
    if (removed instanceof File && blobUrlCache.current.has(removed)) {
      URL.revokeObjectURL(blobUrlCache.current.get(removed));
      blobUrlCache.current.delete(removed);
    }
    const newData = {
      ...formData[itemId],
      images: formData[itemId]?.images?.filter((_, index) => index !== imageIndex) || []
    };

    setFormData(prev => ({
      ...prev,
      [itemId]: newData
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, itemId) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      handleImageUpload(itemId, files);
    }
  };

  useEffect(() => {
    const fetchChecklistItems = async () => {
      try {
        setLoading(true);

        // Fetch checklist details first
        const checklistResponse = await checklistAPI.getChecklist(id);
        const checklistData = checklistResponse.data.checklist;
        setChecklist(checklistData);

        // Fetch checklist items
        const response = await checklistAPI.getChecklistItems(id);
        const loadedItems = response.data.items.map(item => ({
          ...item,
          editableActivities: !item.activities || item.criticality === 'New',
          editableProcess: !item.process || item.criticality === 'New',
          isNew: item.criticality === 'New'
        }));
        setItems(loadedItems);

        // Set additional fields from checklist table
        if (checklistData) {
          setAdditionalFields(prev => ({
            ...prev,
            location: checklistData.location_name || '',
            department: checklistData.department_name || '',
            totalCameraCount: checklistData.camera_count || '',
            totalCameraAudited: checklistData.total_camera_audited || '',
            totalCameraRandomAudited: checklistData.total_camera_random_audited || '',
            totalCameraNotAudited: checklistData.total_camera_not_audited || '',
            totalCameraOffline: checklistData.total_camera_offline || '',
            totalCameraOfflinePercent: checklistData.total_camera_offline_percent || '',
            totalCameraTechnicalIssues: checklistData.total_camera_technical_issues || '',
            totalCameraTechnicalIssuesPercent: checklistData.total_camera_technical_issues_percent || '',
            totalNCs: checklistData.total_ncs || '',
            remark: checklistData.remark || ''
          }));

          // Set elapsed time from checklist table if available
          if (checklistData.time_taken_seconds) {
            const timer = getTimer(id);
            if (timer.elapsed === 0) {
              startTimer(id, checklistData.time_taken_seconds);
              stopTimer(id);
            }
          }

          // Check if user can edit based on role and checklist status
          const checkEditPermission = () => {
            // Super Admin can always edit
            if (user?.role === 'Super Admin') {
              return true;
            }

            // Auditor / Lead-Auditor can edit any checklist
            if (user?.role === 'Auditor' || user?.role === 'Lead-Auditor') {
              return true;
            }

            // Other roles cannot edit
            return false;
          };

          setCanEdit(checkEditPermission());
        }

        // Fetch checklist responses (for supervisors and completed checklists)
        try {
          const responsesResponse = await checklistAPI.getChecklistResponses(id);
          if (responsesResponse.data.responses && responsesResponse.data.responses.length > 0) {
            const responseFormData = {};
            const responseSearchTerms = {};
            responsesResponse.data.responses.forEach(response => {
              responseFormData[response.checklist_item_id] = {
                status: response.status,
                category: response.category,
                reason: response.reason,
                textbox: response.textbox || '',
                images: response.images || []
              };
              if (response.category) {
                responseSearchTerms[response.checklist_item_id] = response.category;
              }
            });
            setFormData(responseFormData);
            setSearchTerms(responseSearchTerms);
          }
        } catch (responseErr) {
          // No responses found, trying draft data

          // Fallback to draft data if no responses found
          try {
            const draftResponse = await checklistAPI.getDraftChecklist(id);
            if (draftResponse.data.data && draftResponse.data.data.length > 0) {
              const draftFormData = {};
              const draftSearchTerms = {};
              draftResponse.data.data.forEach(draft => {
                draftFormData[draft.checklist_item_id] = {
                  status: draft.status,
                  category: draft.category,
                  reason: draft.reason,
                  textbox: draft.textbox || '',
                  images: draft.image_name ? draft.image_name.split(',').map(img => ({
                    name: img,
                    url: `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img}`
                  })) : []
                };
                if (draft.category) {
                  draftSearchTerms[draft.checklist_item_id] = draft.category;
                }
              });
              setFormData(draftFormData);
              setSearchTerms(draftSearchTerms);
              if (draftResponse.data.data[0].time_taken_seconds) {
                const timer = getTimer(id);
                if (timer.elapsed === 0) {
                  startTimer(id, draftResponse.data.data[0].time_taken_seconds);
                  stopTimer(id);
                }
              }
            }
          } catch (draftErr) {
            // No draft data found
          }
        }

        // Fetch executive data for SC checklists
        if (checklistData && checklistData.type === 'SC') {
          try {
            const executiveResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/executive/checklist/${id}/data/auditor`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (executiveResponse.ok) {
              const executiveResult = await executiveResponse.json();
              setExecutiveData(executiveResult.data);
            }
          } catch (execErr) {
            // No executive data found
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch checklist items');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChecklistItems();
    } else {
      setLoading(false);
      setError('No checklist ID provided');
    }
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.search-dropdown')) {
        setShowDropdowns({});
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!showImageModal) return;

      if (event.key === 'Escape') {
        setShowImageModal(false);
      } else if (event.key === 'ArrowLeft' && selectedImages.length > 1) {
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : selectedImages.length - 1;
        setCurrentImageIndex(newIndex);
      } else if (event.key === 'ArrowRight' && selectedImages.length > 1) {
        const newIndex = currentImageIndex < selectedImages.length - 1 ? currentImageIndex + 1 : 0;
        setCurrentImageIndex(newIndex);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages, currentImageIndex]);

  // Auto-calculate Total NCs based on items with "No" status
  useEffect(() => {
    const totalNCs = Object.values(formData).filter(item => item.status === 'No').length;
    setAdditionalFields(prev => ({ ...prev, totalNCs: totalNCs.toString() }));
  }, [formData]);

  // Auto-calculate percentages and not audited count
  useEffect(() => {
    const totalCount = parseInt(additionalFields.totalCameraCount) || 0;
    const audited = parseInt(additionalFields.totalCameraAudited) || 0;
    const randomAudited = parseInt(additionalFields.totalCameraRandomAudited) || 0;
    const offline = parseInt(additionalFields.totalCameraOffline) || 0;
    const technical = parseInt(additionalFields.totalCameraTechnicalIssues) || 0;

    // CALCULATION: Not Audited = Total Count - Audited (initially equals Total Count)
    const notAudited = totalCount - audited;
    const offlinePercent = notAudited > 0 ? ((offline / notAudited) * 100).toFixed(2) : '0';
    const technicalPercent = notAudited > 0 ? ((technical / notAudited) * 100).toFixed(2) : '0';

    setAdditionalFields(prev => ({
      ...prev,
      totalCameraNotAudited: notAudited >= 0 ? notAudited.toString() : '0',
      totalCameraOfflinePercent: offlinePercent,
      totalCameraTechnicalIssuesPercent: technicalPercent
    }));
  }, [additionalFields.totalCameraCount, additionalFields.totalCameraAudited, additionalFields.totalCameraRandomAudited, additionalFields.totalCameraOffline, additionalFields.totalCameraTechnicalIssues]);

  // Handle tab visibility change - removed auto-pause functionality
  // Timer continues running even when tab is hidden



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">{error}</div>
      </div>
    );
  }



  return (
    <div className="p-4">
      {/* Image Modal */}
      {imageModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeImageModal}>
          <div className="bg-white p-4 rounded-lg max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{imageModal.alt}</h3>
              <button
                onClick={closeImageModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <img
              src={imageModal.src}
              alt={imageModal.alt}
              className="max-w-full max-h-[70vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">
                {formatChecklistName(checklist?.checklist_name) || `Checklist ID: ${id}`}
              </h1>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                {items.length > 0 ? items[0]?.type || 'Type' : 'Type'}
              </span>
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.department_name || 'Department'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.location_name || 'Location'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-4">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {formatDate(new Date())}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                  High: {items.filter(item => item.criticality === 'High').length}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                  Low: {items.filter(item => item.criticality === 'Low').length}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('New')}`}>
                  New: {items.filter(item => item.isNew || item.criticality === 'New').length}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  Total: {items.length}
                </span>
              </div>
              <div className="flex items-center gap-4 justify-end">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-md">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    onChange={(e) => handleSelectAll(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1"
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-mono font-bold text-blue-600">{formatTime(getTimer(id).elapsed)}</div>
                  <div className="text-xs text-gray-500">Time Elapsed</div>
                </div>
                <button
                  onClick={() => getTimer(id).isRunning ? stopTimer(id) : startTimer(id, getTimer(id).elapsed)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-md font-medium ${getTimer(id).isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                    } text-white transition-colors disabled:opacity-50`}
                >
                  {getTimer(id).isRunning ? 'Stop Timer' : 'Start Timer'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Checklist List Accordion - Always visible for Auditors, visible for Supervisors when needed */}
          {(user?.role === 'Auditor' || user?.role === 'Super Admin' || user?.role === 'Lead-Auditor') && (
            <div className="border border-gray-200 rounded-lg mb-6">
              <button
                onClick={() => setShowForm(!showForm)}
                className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
              >
                <span className="font-medium text-gray-900">Checklist List</span>
                {showForm ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
              </button>
              {showForm && (
                <div className="p-4">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No items found for this checklist.
                    </div>
                  ) : (
                    <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="min-w-full">
                          <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>
                                Activities
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>
                                Process
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '160px' }}>
                                Status
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>
                                Reason
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>
                                Images
                              </th>
                              {checklist?.type === 'SC' && executiveData && (
                                <>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>
                                    Response
                                  </th>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>
                                    Executive Images
                                  </th>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>
                                    Executive Reason
                                  </th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => {
                              const itemId = item.id || index;
                              const itemData = formData[itemId] || {};
                              return (
                                <tr key={itemId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '200px' }}>
                                    <div className="flex items-center gap-2">
                                      {(item.isNew || item.editableActivities) ? (
                                        <input
                                          type="text"
                                          value={itemData.activities || item.activities || ''}
                                          onChange={(e) => {
                                            const newItems = [...items];
                                            const itemIndex = newItems.findIndex(i => (i.id || items.indexOf(i)) === itemId);
                                            if (itemIndex !== -1) {
                                              newItems[itemIndex] = { ...newItems[itemIndex], activities: e.target.value };
                                              setItems(newItems);
                                            }
                                            setFormData(prev => ({
                                              ...prev,
                                              [itemId]: { ...prev[itemId], activities: e.target.value }
                                            }));
                                          }}
                                          disabled={!getTimer(id).isRunning}
                                          placeholder="Enter activities..."
                                          autoComplete="off"
                                          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        />
                                      ) : (
                                        <>
                                          {item.activities} &nbsp;
                                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                                            {item.criticality || 'N/A'}
                                          </span>
                                        </>
                                      )}
                                      {item.isNew && (
                                        <button
                                          onClick={() => deleteNewItem(itemId)}
                                          disabled={!getTimer(id).isRunning}
                                          className="text-red-500 hover:text-red-700 disabled:opacity-50 text-xl font-bold w-6 h-6 flex items-center justify-center"
                                          title="Delete item"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900" style={{ minWidth: '120px' }}>
                                    {(item.isNew || item.editableProcess) ? (
                                      <input
                                        type="text"
                                        value={itemData.process || item.process || ''}
                                        onChange={(e) => {
                                          const newItems = [...items];
                                          const itemIndex = newItems.findIndex(i => (i.id || items.indexOf(i)) === itemId);
                                          if (itemIndex !== -1) {
                                            newItems[itemIndex] = { ...newItems[itemIndex], process: e.target.value };
                                            setItems(newItems);
                                          }
                                          setFormData(prev => ({
                                            ...prev,
                                            [itemId]: { ...prev[itemId], process: e.target.value }
                                          }));
                                        }}
                                        disabled={!getTimer(id).isRunning}
                                        placeholder="Enter process..."
                                        autoComplete="off"
                                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      />
                                    ) : (
                                      item.process
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap" style={{ minWidth: '160px' }}>
                                    <div className="space-y-2" style={{ width: '140px' }}>
                                      <select
                                        value={itemData.status || ''}
                                        onChange={(e) => handleStatusChange(itemId, e.target.value)}
                                        disabled={!getTimer(id).isRunning}
                                        className={`text-sm border rounded-md px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed ${validationErrors[itemId]?.status ? 'border-red-500' : 'border-gray-300'
                                          }`}
                                        style={{ width: '140px' }}
                                      >
                                        {Checklist_STATUS_OPTIONS.map(option => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                      {validationErrors[itemId]?.status && (
                                        <p className="text-red-500 text-xs mt-1">{validationErrors[itemId].status}</p>
                                      )}
                                      {itemData.status === 'No' && (
                                        <div>
                                          <Select2Dropdown
                                            value={itemData.category || ''}
                                            onChange={(value) => handleCategoryChange(itemId, value)}
                                            options={CATEGORY_OPTIONS}
                                            placeholder="Select category..."
                                            disabled={!getTimer(id).isRunning}
                                            className={`text-sm ${validationErrors[itemId]?.category ? 'border-red-500' : 'border-gray-300'
                                              }`}
                                            style={{ width: '140px' }}
                                          />
                                          {validationErrors[itemId]?.category && (
                                            <p className="text-red-500 text-xs mt-1">{validationErrors[itemId].category}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3" style={{ minWidth: '180px' }}>
                                    <input
                                      type="text"
                                      value={itemData.reason || ''}
                                      onChange={(e) => handleReasonChange(itemId, e.target.value)}
                                      disabled={!getTimer(id).isRunning}
                                      placeholder="Enter reason..."
                                      autoComplete="off"
                                      className={`w-full text-sm border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${validationErrors[itemId]?.reason ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    />
                                    {validationErrors[itemId]?.reason && (
                                      <p className="text-red-500 text-xs mt-1">{validationErrors[itemId].reason}</p>
                                    )}
                                  </td>
                                  <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                                    <div className="space-y-2">
                                      {itemData.images && itemData.images.length > 0 && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-xs text-gray-500">{itemData.images.length} image(s)</span>
                                          <button
                                            onClick={() => setFormData(prev => ({ ...prev, [itemId]: { ...prev[itemId], images: [] } }))}
                                            disabled={!getTimer(id).isRunning}
                                            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                                          >
                                            Delete All
                                          </button>
                                        </div>
                                      )}
                                      <div
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, itemId)}
                                        onClick={() => document.getElementById(`file-${itemId}`).click()}
                                        className={`border-2 border-dashed rounded-lg p-2 cursor-pointer hover:bg-gray-50 min-h-[120px] max-h-[200px] overflow-y-auto ${validationErrors[itemId]?.images ? 'border-red-500' : 'border-gray-300'
                                          }`}
                                      >
                                        <input
                                          type="file"
                                          multiple
                                          accept="image/*"
                                          onChange={(e) => { handleImageUpload(itemId, e.target.files); e.target.value = ''; }}
                                          disabled={!getTimer(id).isRunning}
                                          className="hidden"
                                          id={`file-${itemId}`}
                                        />
                                        {itemData.images && itemData.images.length > 0 ? (
                                          <div className="flex gap-1 flex-wrap">
                                            {itemData.images.slice(0, 3).map((image, imgIndex) => (
                                              <div key={imgIndex} className="relative group">
                                                <img
                                                  src={image instanceof File ? getBlobUrl(image) : (image.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image.name || image)}`)}
                                                  alt={`Upload ${imgIndex + 1}`}
                                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const imageUrls = itemData.images.map(img =>
                                                      img instanceof File ? getBlobUrl(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)
                                                    );
                                                    setSelectedImages(imageUrls);
                                                    setCurrentImageIndex(imgIndex);
                                                    setShowImageModal(true);
                                                  }}
                                                />
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeImage(itemId, imgIndex);
                                                  }}
                                                  disabled={!getTimer(id).isRunning}
                                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center disabled:opacity-50 opacity-80 group-hover:opacity-100"
                                                  title="Delete image"
                                                >
                                                  ×
                                                </button>
                                              </div>
                                            ))}
                                            {itemData.images.length > 3 && (
                                              <div
                                                className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const imageUrls = itemData.images.map(img =>
                                                    img instanceof File ? getBlobUrl(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)
                                                  );
                                                  setSelectedImages(imageUrls);
                                                  setCurrentImageIndex(3);
                                                  setShowImageModal(true);
                                                }}
                                              >
                                                +{itemData.images.length - 3}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center h-full">
                                            <div className="text-sm text-gray-600 text-center">
                                              <p>Drag images or click to browse</p>
                                              <p className="text-xs text-gray-400 mt-1">Multiple files supported</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {validationErrors[itemId]?.images && (
                                        <p className="text-red-500 text-xs">{validationErrors[itemId].images}</p>
                                      )}
                                    </div>
                                  </td>
                                  {checklist?.type === 'SC' && executiveData && (
                                    <>
                                      <td className="px-4 py-3" style={{ minWidth: '180px' }}>
                                        <input
                                          type="text"
                                          value={itemData.textbox || ''}
                                          onChange={(e) => {
                                            handleTextboxChange(itemId, e.target.value);
                                            setValidationErrors(prev => {
                                              if (prev[itemId]) {
                                                const { textbox: _, images: __, ...rest } = prev[itemId];
                                                return { ...prev, [itemId]: rest };
                                              }
                                              return prev;
                                            });
                                          }}
                                          disabled={!getTimer(id).isRunning}
                                          placeholder="Enter Response..."
                                          autoComplete="off"
                                          className={`w-full text-sm border rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${validationErrors[itemId]?.textbox ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                        {validationErrors[itemId]?.textbox && (
                                          <p className="text-red-500 text-xs mt-1">{validationErrors[itemId].textbox}</p>
                                        )}
                                      </td>
                                      <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                                        {(() => {
                                          const execItem = executiveData.find(exec => exec.daily_item_id === itemId || exec.checklist_item_id === itemId);
                                          if (execItem && execItem.image_name) {
                                            const execImages = execItem.image_name.split(',').filter(img => img.trim());
                                            return (
                                              <div className="flex gap-1 items-center">
                                                {execImages.slice(0, 3).map((image, imgIndex) => (
                                                  <img
                                                    key={imgIndex}
                                                    src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${image.trim()}`}
                                                    alt={`Executive ${imgIndex + 1}`}
                                                    className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                                    onClick={() => {
                                                      const imageUrls = execImages.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.trim()}`);
                                                      setExecutiveImageModal({ show: true, images: imageUrls, currentIndex: imgIndex });
                                                    }}
                                                  />
                                                ))}
                                                {execImages.length > 3 && (
                                                  <div
                                                    className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                                    onClick={() => {
                                                      const imageUrls = execImages.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.trim()}`);
                                                      setExecutiveImageModal({ show: true, images: imageUrls, currentIndex: 3 });
                                                    }}
                                                  >
                                                    +{execImages.length - 3}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                          return <span className="text-gray-400 text-sm">No images</span>;
                                        })()}
                                      </td>
                                      <td className="px-4 py-3" style={{ minWidth: '180px' }}>
                                        {(() => {
                                          const execItem = executiveData.find(exec => exec.daily_item_id === itemId || exec.checklist_item_id === itemId);
                                          return execItem?.reason || <span className="text-gray-400 text-sm">No reason</span>;
                                        })()}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                        <label className="text-sm font-medium text-gray-700">
                          Add Items:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={newItemsCount}
                          onChange={(e) => setNewItemsCount(parseInt(e.target.value) || 1)}
                          disabled={!getTimer(id).isRunning}
                          className="w-20 text-sm border border-gray-300 rounded-md px-2 py-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <button
                          onClick={addNewItems}
                          disabled={!getTimer(id).isRunning}
                          className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Add Checklist Items
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Checklist Details Accordion */}
          {(user?.role === 'Auditor' || user?.role === 'Super Admin' || user?.role === 'Lead-Auditor') && (
            <div className="border border-gray-200 rounded-lg mb-6">
              <button
                onClick={() => setShowAdditionalFields(!showAdditionalFields)}
                className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
              >
                <span className="font-medium text-gray-900">Checklist Details</span>
                {showAdditionalFields ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
              </button>
              {showAdditionalFields && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {checklist?.type !== 'SC' && (
                      <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input
                        type="text"
                        value={additionalFields.location}
                        readOnly
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, location: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter location"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={additionalFields.department}
                        readOnly
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, department: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter department"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Count</label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraCount}
                        readOnly
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, totalCameraCount: e.target.value }))}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter total camera count"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Audited <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraAudited}
                        min={0}
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, totalCameraAudited: e.target.value }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter audited count"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Random Audited <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraRandomAudited}
                        min={0}
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, totalCameraRandomAudited: e.target.value }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter random audited count"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Not Audited</label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraNotAudited}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                        placeholder="Auto-calculated"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Offline <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraOffline}
                        min={0}
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, totalCameraOffline: e.target.value }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter offline count"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Offline Percent</label>
                      <input
                        type="text"
                        value={additionalFields.totalCameraOfflinePercent + '%'}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                        placeholder="Auto-calculated"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Technical Issues <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={additionalFields.totalCameraTechnicalIssues}
                        min={0}
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, totalCameraTechnicalIssues: e.target.value }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter technical issues count"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Camera Technical Issues Percent</label>
                      <input
                        type="text"
                        value={additionalFields.totalCameraTechnicalIssuesPercent + '%'}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                        placeholder="Auto-calculated"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Camera File</label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.xls,.xlsx"
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, cameraFile: e.target.files[0] }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Supported: Images, PDF, Excel files (Max 25MB)</p>
                      {additionalFields.cameraFile && (
                        <p className="text-xs text-green-600 mt-1">Selected: {additionalFields.cameraFile.name}</p>
                      )}
                      {checklist?.camera_file && !additionalFields.cameraFile && (
                        <div className="mt-2">
                          <a
                            href={`${process.env.REACT_APP_BACKEND_URL}/uploads/camera-files/${checklist.camera_file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            View uploaded file: {checklist.camera_file.split('-').slice(1).join('-')}
                          </a>
                        </div>
                      )}
                    </div>
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total NCs</label>
                      <input
                        type="number"
                        value={additionalFields.totalNCs}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100"
                        placeholder="Auto-calculated"
                        readOnly
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Remark</label>
                      <textarea
                        value={additionalFields.remark}
                        onChange={(e) => setAdditionalFields(prev => ({ ...prev, remark: e.target.value }))}
                        disabled={!getTimer(id).isRunning}
                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        rows="3"
                        placeholder="Enter remarks"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-4 p-4 border-t border-gray-200">

            <button
              onClick={handleSave}
              disabled={saving || !getTimer(id).isRunning}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2 bg-btn-primary disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button
              onClick={handleComplete}
              disabled={saving || !getTimer(id).isRunning}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2 bg-btn-primary disabled:opacity-50 transition-all duration-200"
            >
              {saving ? 'Processing...' : 'Complete Checklist'}
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery Modal */}
      {showImageModal && selectedImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <a
              href={selectedImages[currentImageIndex]}
              download
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </a>

            {selectedImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1);
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={selectedImages[currentImageIndex]}
              alt={`Preview ${currentImageIndex + 1}`}
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {selectedImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {currentImageIndex + 1} / {selectedImages.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Executive Image Gallery Modal */}
      {executiveImageModal.show && executiveImageModal.images.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setExecutiveImageModal({ show: false, images: [], currentIndex: 0 })}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setExecutiveImageModal({ show: false, images: [], currentIndex: 0 })}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <a
              href={executiveImageModal.images[executiveImageModal.currentIndex]}
              download
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </a>

            {executiveImageModal.images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExecutiveImageModal(prev => ({
                      ...prev,
                      currentIndex: prev.currentIndex > 0 ? prev.currentIndex - 1 : prev.images.length - 1
                    }));
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExecutiveImageModal(prev => ({
                      ...prev,
                      currentIndex: prev.currentIndex < prev.images.length - 1 ? prev.currentIndex + 1 : 0
                    }));
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={executiveImageModal.images[executiveImageModal.currentIndex]}
              alt={`Executive Preview ${executiveImageModal.currentIndex + 1}`}
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {executiveImageModal.images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {executiveImageModal.currentIndex + 1} / {executiveImageModal.images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistForm;
