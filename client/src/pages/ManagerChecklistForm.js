import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import { SUPERVISOR_REASONS, getCriticalityBadgeClass, buildImageUrl, formatTime } from '../utils/checklistUtils';
import { formatDate } from '../utils/dateFormatter';
import showToast from '../utils/toast';
import MobileSelect from '../components/UI/MobileSelect';

const ManagerChecklistForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [executiveData, setExecutiveData] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [supervisorReviews, setSupervisorReviews] = useState({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedImages, setSelectedImages] = useState([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const handleImageView = (imageSrc) => {
    setImageModal({ show: true, src: imageSrc, alt: 'Manager Image' });
  };

  const closeImageModal = () => {
    setImageModal({ show: false, src: '', alt: '' });
  };

  const handleManagerSubmit = async () => {
    const errors = {};
    const reviewItemIds = Object.keys(supervisorReviews);

    reviewItemIds.forEach(itemId => {
      const supervisorData = supervisorReviews[itemId] || {};
      const existingManagerStatus = supervisorData.manager_status;
      
      // Skip validation if item already has a manager status
      if (existingManagerStatus) {
        return;
      }
      
      const status = formData[`manager_status_${itemId}`];
      const reason = formData[`manager_reason_${itemId}`];

      if (!status) {
        errors[`manager_status_${itemId}`] = 'Status is required';
      }
      if (status === 'Rejected' && !reason?.trim()) {
        errors[`manager_reason_${itemId}`] = 'Reason is required';
      }
    });

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setSaving(true);
      setValidationErrors({});
      
      const managerData = {};
      reviewItemIds.forEach(itemId => {
        const supervisorData = supervisorReviews[itemId] || {};
        const existingManagerStatus = supervisorData.manager_status;
        
        managerData[itemId] = {
          reason: formData[`manager_reason_${itemId}`],
          status: formData[`manager_status_${itemId}`] || existingManagerStatus,
          images: formData[`manager_${itemId}`]?.images || []
        };
      });
      
      await checklistAPI.submitManagerReview(id, managerData);
        showToast('success', 'Manager review submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Manager submit error:', error);
      showToast('error', error.response?.data?.error || 'Failed to submit manager review');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (itemId, files) => {
    const newData = {
      ...formData[itemId],
      images: [...(formData[itemId]?.images || []), ...Array.from(files)]
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
    const handleKeyDown = (event) => {
      if (!showImageModal) return;
      
      if (event.key === 'Escape') {
        setShowImageModal(false);
      } else if (event.key === 'ArrowLeft' && selectedImages.length > 1) {
        setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1);
      } else if (event.key === 'ArrowRight' && selectedImages.length > 1) {
        setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages, currentImageIndex]);

  useEffect(() => {
    const fetchChecklistItems = async () => {
      try {
        setLoading(true);
        
        const checklistResponse = await checklistAPI.getChecklist(id);
        const checklistData = checklistResponse.data.checklist;
        setChecklist(checklistData);
        
        const response = await checklistAPI.getChecklistItems(id);
        setItems(response.data.items);
        
        try {
          const responsesResponse = await checklistAPI.getChecklistResponses(id);
          const supervisorResponse = await checklistAPI.getManagerReviewItems(id);
          
          if (responsesResponse.data.responses && responsesResponse.data.responses.length > 0) {
            const responseFormData = {};
            responsesResponse.data.responses.forEach(response => {
              responseFormData[response.checklist_item_id] = {
                status: response.status,
                category: response.category,
                reason: response.reason,
                textbox: response.textbox || '',
                images: response.images || []
              };
            });
            setFormData(responseFormData);
          }
          
          if (supervisorResponse.data.reviews && supervisorResponse.data.reviews.length > 0) {
            const supervisorData = {};
            const reviewFormData = {};
            supervisorResponse.data.reviews.forEach(review => {
              // Process supervisor images properly
              let supervisorImages = [];
              if (review.supervisor_images && Array.isArray(review.supervisor_images)) {
                supervisorImages = review.supervisor_images;
              } else if (review.supervisor_images && typeof review.supervisor_images === 'string') {
                supervisorImages = review.supervisor_images.split(',').map(img => img.trim()).filter(img => img);
              }
              
              supervisorData[review.id] = {
                reason: review.supervisor_reason,
                images: supervisorImages,
                manager_status: review.manager_status, // Store manager_status here
                supervisor_status: review.supervisor_status // Store supervisor_status here
              };
              // Add the review items to formData so they show up in the table
              reviewFormData[review.id] = {
                status: review.status,
                category: review.category,
                reason: review.reason,
                textbox: review.textbox || '',
                images: review.images || []
              };
            });
            setSupervisorReviews(supervisorData);
            // Merge with existing formData
            setFormData(prev => ({ ...prev, ...reviewFormData }));
          }
        } catch (responseErr) {
          console.log('No responses found');
        }
        
        // Fetch executive data for SC checklists
        if (checklistData?.type === 'SC') {
          try {
            const executiveRes = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/executive/checklist/${id}/data/auditor`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            if (executiveRes.ok) {
              const executiveResult = await executiveRes.json();
              setExecutiveData(executiveResult.data || []);
            }
          } catch (error) {
            console.error('Error fetching executive data:', error);
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

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const reviewItemIds = Object.keys(supervisorReviews);

    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-600"><ArrowLeftIcon className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate" style={{ fontSize: '16px' }}>{checklist?.checklist_name || `Checklist #${id}`}</p>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>{checklist?.location_name} • {checklist?.department_name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
          {reviewItemIds.length === 0 ? (
            <div className="text-center py-16 text-gray-400" style={{ fontSize: '14px' }}>No items found for manager review.</div>
          ) : reviewItemIds.map((itemId, index) => {
            const item = items.find(i => i.id == itemId) || { activities: 'N/A', process: 'N/A' };
            const itemData = formData[itemId] || {};
            const supervisorData = supervisorReviews[itemId] || {};
            const managerStatus = supervisorData.manager_status === 'Approved' ? 'Approved' : '';
            const isFilled = !!(formData[`manager_status_${itemId}`] || managerStatus);
            const auditorImages = itemData.images || [];
            const supervisorImages = supervisorData.images || [];

            return (
              <div key={itemId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer" onClick={() => setFormData(prev => ({ ...prev, _mobileModal: itemId }))}>
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="font-bold text-gray-500" style={{ fontSize: '13px' }}>#{index + 1}</span>
                  {isFilled && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold" style={{ fontSize: '11px' }}>Filled</span>}
                </div>

                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Activity</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item.activities || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Process</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item.process || '-'}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="font-semibold text-gray-500 mb-2" style={{ fontSize: '11px' }}>AUDITOR REASON & IMAGES</p>
                    <p className="font-semibold text-gray-800 mb-2" style={{ fontSize: '13px' }}>{itemData.reason || '-'}</p>
                    {auditorImages.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {auditorImages.slice(0, 4).map((image, imgIndex) => {
                          const url = image instanceof File ? URL.createObjectURL(image) : (image.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${image.name || image}`);
                          return <img key={imgIndex} src={url} alt={`a-${imgIndex}`} className="w-14 h-14 object-cover rounded-lg border cursor-pointer" onClick={(e) => { e.stopPropagation(); const urls = auditorImages.map(img => img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)); setSelectedImages(urls); setCurrentImageIndex(imgIndex); setShowImageModal(true); }} />;
                        })}
                        {auditorImages.length > 4 && <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); const urls = auditorImages.map(img => img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)); setSelectedImages(urls); setCurrentImageIndex(0); setShowImageModal(true); }}>+{auditorImages.length - 4}</div>}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="font-semibold text-gray-500 mb-2" style={{ fontSize: '11px' }}>SUPERVISOR REASON & IMAGES</p>
                    <p className="font-semibold text-gray-800 mb-2" style={{ fontSize: '13px' }}>{supervisorData.reason || '-'}</p>
                    {supervisorImages.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {supervisorImages.slice(0, 4).map((image, imgIndex) => {
                          const imgName = typeof image === 'string' ? image : (image.name || image);
                          const url = `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${imgName}`;
                          return <img key={imgIndex} src={url} alt={`s-${imgIndex}`} className="w-14 h-14 object-cover rounded-lg border cursor-pointer" onClick={(e) => { e.stopPropagation(); const urls = supervisorImages.map(img => { const n = typeof img === 'string' ? img : (img.name || img); return `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${n}`; }); setSelectedImages(urls); setCurrentImageIndex(imgIndex); setShowImageModal(true); }} />;
                        })}
                        {supervisorImages.length > 4 && <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer" onClick={(e) => { e.stopPropagation(); const urls = supervisorImages.map(img => { const n = typeof img === 'string' ? img : (img.name || img); return `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${n}`; }); setSelectedImages(urls); setCurrentImageIndex(0); setShowImageModal(true); }}>+{supervisorImages.length - 4}</div>}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Supervisor Status</p>
                    <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{supervisorData.supervisor_status || '-'}</p>
                  </div>
                </div>

                <div className="flex border-t border-gray-100">
                  <button onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, _mobileModal: itemId })); }}
                    className="mobile-btn-text flex-1 py-4 font-semibold text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    {isFilled ? 'Edit Action' : 'Action'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Modal - React state based */}
        {formData._mobileModal && (() => {
          const itemId = formData._mobileModal;
          const supervisorData = supervisorReviews[itemId] || {};
          const managerStatus = supervisorData.manager_status === 'Approved' ? 'Approved' : '';
          return (
            <div className="fixed inset-0 z-[100] bg-white flex flex-col">
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <button onClick={() => setFormData(prev => ({ ...prev, _mobileModal: null }))} className="text-gray-600"><ArrowLeftIcon className="w-5 h-5" /></button>
                <p className="font-bold text-gray-800" style={{ fontSize: '16px' }}>Action</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Status *</label>
                  <MobileSelect
                    label="Status"
                    value={formData[`manager_status_${itemId}`] || managerStatus || ''}
                    onChange={(val) => { setFormData(prev => ({ ...prev, [`manager_status_${itemId}`]: val })); setValidationErrors(prev => { const n = { ...prev }; delete n[`manager_status_${itemId}`]; return n; }); }}
                    options={[{ value: 'Approved', label: 'Approved' }, { value: 'Rejected', label: 'Rejected' }]}
                    placeholder="Select Status"
                  />
                  {validationErrors[`manager_status_${itemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`manager_status_${itemId}`]}</p>}
                </div>
                {formData[`manager_status_${itemId}`] === 'Rejected' && (
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Rejection Reason *</label>
                    <textarea
                      value={formData[`manager_reason_${itemId}`] || ''}
                      onChange={(e) => { setFormData(prev => ({ ...prev, [`manager_reason_${itemId}`]: e.target.value })); setValidationErrors(prev => { const n = { ...prev }; delete n[`manager_reason_${itemId}`]; return n; }); }}
                      rows="3" placeholder="Enter rejection reason..."
                      className={`w-full px-3 py-2 border rounded-xl text-sm ${validationErrors[`manager_reason_${itemId}`] ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {validationErrors[`manager_reason_${itemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`manager_reason_${itemId}`]}</p>}
                  </div>
                )}
              </div>
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
                <button onClick={() => setFormData(prev => ({ ...prev, _mobileModal: null }))}
                  className="mobile-btn-text w-full py-3 font-bold text-white bg-btn-primary rounded-xl">Done</button>
              </div>
            </div>
          );
        })()}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10 flex justify-end">
          <button onClick={handleManagerSubmit} disabled={saving} className="mobile-btn-text px-8 py-2.5 font-semibold text-white bg-btn-primary rounded-xl disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit Manager Review'}
          </button>
        </div>

        {showImageModal && selectedImages.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200]" onClick={() => setShowImageModal(false)}>
            <div className="relative w-full h-full flex items-center justify-center">
              <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><XMarkIcon className="w-6 h-6" /></button>
              <a href={selectedImages[currentImageIndex]} download onClick={e => e.stopPropagation()} className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ArrowDownTrayIcon className="w-6 h-6" /></a>
              {selectedImages.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronLeftIcon className="w-6 h-6" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronRightIcon className="w-6 h-6" /></button>
                </>
              )}
              <img src={selectedImages[currentImageIndex]} alt={`Preview ${currentImageIndex + 1}`} className="w-full h-full object-contain" onClick={e => e.stopPropagation()} />
              {selectedImages.length > 1 && <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">{currentImageIndex + 1} / {selectedImages.length}</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
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
                {checklist?.checklist_name || `Checklist ID: ${id}`}
              </h1>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
                {items.length > 0 ? items[0]?.type || 'Type' : 'Type'}
              </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.department_name || 'Department'}
              </span>
              <span className="text-gray-400">•</span>
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.location_name || 'Location'}
              </span>

                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {formatDate(new Date(checklist?.created_at))}
                </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg mb-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
            >
              <span className="font-medium text-gray-900">Manager Review Items</span>
              {showForm ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
            </button>
            {showForm && (
              <div className="p-4">
                {Object.keys(supervisorReviews).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No items found for manager review.
                  </div>
                ) : (
                  <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                    <div className="overflow-auto" style={{maxHeight: '600px'}}>
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '200px'}}>
                              Activity
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '150px'}}>
                              Process
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '300px'}}>
                              Auditor Reason & Images
                            </th>
                            {checklist?.type === 'SC' && (
                              <>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '150px'}}>
                                  Executive Images
                                </th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '150px'}}>
                                  Executive Reason
                                </th>
                              </>
                            )}
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '300px'}}>
                              Supervisor Reason & Images
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '120px'}}>
                              Supervisor Status
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '120px'}}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.keys(supervisorReviews).map((itemId, index) => {
                            const item = items.find(i => i.id == itemId) || { id: itemId, activities: 'N/A', process: 'N/A' };
                            const itemData = formData[itemId] || {};
                            const supervisorData = supervisorReviews[itemId] || {};
                            const executiveResponse = executiveData.find(exec => exec.daily_item_id == itemId || exec.checklist_item_id == itemId);
                            const executiveImages = executiveResponse?.image_name?.split(',').filter(img => img) || [];
                            
                            // Get manager_status from supervisorData
                            const managerStatus = supervisorData.manager_status === 'Approved' ? 'Approved' : '';
                            return (
                              <tr key={itemId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{minWidth: '200px'}}>
                                  {item.activities || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{minWidth: '150px'}}>
                                  {item.process || '-'}
                                </td>
                                <td className="px-4 py-3" style={{minWidth: '300px'}}>
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Reason:</div>
                                    <div className="text-sm text-gray-900">{itemData.reason || '-'}</div>
                                    {checklist?.type === 'SC' && itemData.textbox && (
                                      <>
                                        <div className="text-sm font-medium text-gray-700">Response:</div>
                                        <div className="text-sm text-gray-900">{itemData.textbox}</div>
                                      </>
                                    )}
                                    <div className="text-sm font-medium text-gray-700">Images:</div>
                                    {itemData.images && itemData.images.length > 0 ? (
                                      <div className="flex gap-1 flex-wrap">
                                        {itemData.images.slice(0, 3).map((image, imgIndex) => (
                                          <img
                                            key={imgIndex}
                                            src={image instanceof File ? URL.createObjectURL(image) : (image.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${image.name || image}`)}
                                            alt={`Auditor ${imgIndex + 1}`}
                                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                            onClick={() => {
                                              const imageUrls = itemData.images.map(img => 
                                                img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)
                                              );
                                              setSelectedImages(imageUrls);
                                              setCurrentImageIndex(imgIndex);
                                              setShowImageModal(true);
                                            }}
                                          />
                                        ))}
                                        {itemData.images.length > 3 && (
                                          <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                               onClick={() => {
                                                 const imageUrls = itemData.images.map(img => 
                                                   img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`)
                                                 );
                                                 setSelectedImages(imageUrls);
                                                 setCurrentImageIndex(3);
                                                 setShowImageModal(true);
                                               }}>
                                            +{itemData.images.length - 3}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-gray-500 text-sm">No images</div>
                                    )}
                                  </div>
                                </td>
                                {checklist?.type === 'SC' && (
                                  <>
                                    <td className="px-4 py-3" style={{minWidth: '150px'}}>
                                      {executiveImages.length > 0 ? (
                                        <div className="flex gap-1 flex-wrap">
                                          {executiveImages.map((image, imgIndex) => (
                                            <img
                                              key={imgIndex}
                                              src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image)}`}
                                              alt={`Executive ${imgIndex + 1}`}
                                              className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                              onClick={() => {
                                                const imageUrls = executiveImages.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img)}`);
                                                setSelectedImages(imageUrls);
                                                setCurrentImageIndex(imgIndex);
                                                setShowImageModal(true);
                                              }}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-gray-500 text-sm">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900" style={{minWidth: '150px'}}>
                                      {executiveResponse?.reason || '-'}
                                    </td>
                                  </>
                                )}
                                <td className="px-4 py-3" style={{minWidth: '300px'}}>
                                  <div className="space-y-2">
                                    <div className="text-sm font-medium text-gray-700">Reason:</div>
                                    <div className="text-sm text-gray-900">{supervisorData.reason || '-'}</div>
                                    <div className="text-sm font-medium text-gray-700">Images:</div>
                                    {supervisorData.images && supervisorData.images.length > 0 ? (
                                      <div className="flex gap-1 flex-wrap">
                                        {supervisorData.images.slice(0, 3).map((image, imgIndex) => {
                                          const imageName = typeof image === 'string' ? image : (image.name || image);
                                          return (
                                            <img
                                              key={imgIndex}
                                              src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${imageName}`}
                                              alt={`Supervisor ${imgIndex + 1}`}
                                              className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                              onClick={() => {
                                                const imageUrls = supervisorData.images.map(img => {
                                                  const imgName = typeof img === 'string' ? img : (img.name || img);
                                                  return `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${imgName}`;
                                                });
                                                setSelectedImages(imageUrls);
                                                setCurrentImageIndex(imgIndex);
                                                setShowImageModal(true);
                                              }}
                                            />
                                          );
                                        })}
                                        {supervisorData.images.length > 3 && (
                                          <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                               onClick={() => {
                                                 const imageUrls = supervisorData.images.map(img => {
                                                   const imgName = typeof img === 'string' ? img : (img.name || img);
                                                   return `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${imgName}`;
                                                 });
                                                 setSelectedImages(imageUrls);
                                                 setCurrentImageIndex(3);
                                                 setShowImageModal(true);
                                               }}>
                                            +{supervisorData.images.length - 3}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-gray-500 text-sm">No images</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{minWidth: '120px'}}>
                                  {supervisorData.supervisor_status || '-'}
                                </td>
                                <td className="px-4 py-3" style={{minWidth: '120px'}}>
                                  <div className="space-y-2">
                                    <select
                                      value={formData[`manager_status_${itemId}`] || managerStatus || ''}
                                      onChange={(e) => {
                                        setFormData(prev => ({ ...prev, [`manager_status_${itemId}`]: e.target.value }));
                                        setValidationErrors(prev => {
                                          const newErrors = { ...prev };
                                          delete newErrors[`manager_status_${itemId}`];
                                          return newErrors;
                                        });
                                      }}
                                      className={`text-sm border rounded-md px-2 py-1 w-full ${
                                        validationErrors[`manager_status_${itemId}`] ? 'border-red-500' : 'border-gray-300'
                                      }`}
                                    >
                                      <option value="">Select</option>
                                      <option value="Approved">Approved</option>
                                      <option value="Rejected">Rejected</option>
                                    </select>
                                    {validationErrors[`manager_status_${itemId}`] && (
                                      <p className="text-red-500 text-xs mt-1">{validationErrors[`manager_status_${itemId}`]}</p>
                                    )}
                                    {formData[`manager_status_${itemId}`] === 'Rejected' && (
                                      <>
                                        <textarea
                                          placeholder="Rejection reason..."
                                          value={formData[`manager_reason_${itemId}`] || ''}
                                          onChange={(e) => {
                                            setFormData(prev => ({ ...prev, [`manager_reason_${itemId}`]: e.target.value }));
                                            setValidationErrors(prev => {
                                              const newErrors = { ...prev };
                                              delete newErrors[`manager_reason_${itemId}`];
                                              return newErrors;
                                            });
                                          }}
                                          className={`w-full text-sm border rounded-md px-2 py-1 resize-none ${
                                            validationErrors[`manager_reason_${itemId}`] ? 'border-red-500' : 'border-gray-300'
                                          }`}
                                          rows="3"
                                        />
                                        {validationErrors[`manager_reason_${itemId}`] && (
                                          <p className="text-red-500 text-xs mt-1">{validationErrors[`manager_reason_${itemId}`]}</p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-4 p-4 border-t border-gray-200">
            <button
              onClick={handleManagerSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg flex items-center space-x-2 hover:opacity-90 transition-all duration-200"  
            >
              {saving ? 'Submitting...' : 'Submit Manager Review'}
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
    </div>
  );
};

export default ManagerChecklistForm;