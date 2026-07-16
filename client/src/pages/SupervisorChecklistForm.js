import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import { SUPERVISOR_REASONS, getCriticalityBadgeClass, buildImageUrl, formatTime } from '../utils/checklistUtils';
import MobileSelect from '../components/UI/MobileSelect';
import { formatDate } from '../utils/dateFormatter';
import showToast from '../utils/toast';

const SupervisorChecklistForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [existingSupervisorData, setExistingSupervisorData] = useState({});
  const [executiveData, setExecutiveData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [mobileActionModal, setMobileActionModal] = useState(null);

  const handleImageView = (imageSrc) => {
    setImageModal({ show: true, src: imageSrc, alt: 'Auditor Image' });
  };

  const closeImageModal = () => {
    setImageModal({ show: false, src: '', alt: '' });
  };

  const handleSupervisorSubmit = async () => {
    try {
      setSaving(true);

      // Get all non-conformance items
      const nonConformanceItems = items.filter(item => {
        const itemId = item.id || items.indexOf(item);
        const itemData = formData[itemId] || {};
        return itemData.status === 'No';
      });

      // Validate all required fields
      const errors = {};
      let hasErrors = false;

      nonConformanceItems.forEach(item => {
        const itemId = item.id || items.indexOf(item);
        const itemStatus = formData[`supervisor_item_status_${itemId}`];
        const itemReason = formData[`supervisor_item_reason_${itemId}`]?.trim();
        const reason = formData[`supervisor_reason_${itemId}`];
        const status = formData[`supervisor_status_${itemId}`];

        if (!itemStatus) {
          errors[`supervisor_item_status_${itemId}`] = 'Status is required';
          hasErrors = true;
        }
        if (itemStatus === 'Open' && !itemReason) {
          errors[`supervisor_item_reason_${itemId}`] = 'Reason is required';
          hasErrors = true;
        }
        if (!reason) {
          errors[`supervisor_reason_${itemId}`] = 'Reason is required';
          hasErrors = true;
        }
        if (!status) {
          errors[`supervisor_status_${itemId}`] = 'Status is required';
          hasErrors = true;
        }
      });

      if (hasErrors) {
        setValidationErrors(errors);
        setSaving(false);
        return;
      }

      setValidationErrors({});

      const supervisorData = {};
      nonConformanceItems.forEach(item => {
        const itemId = item.id || items.indexOf(item);
        supervisorData[itemId] = {
          status: formData[`supervisor_item_status_${itemId}`],
          reason: formData[`supervisor_item_reason_${itemId}`],
          supervisorStatus: formData[`supervisor_status_${itemId}`],
          images: formData[`supervisor_${itemId}`]?.images || [],
          reasonCategory: formData[`supervisor_reason_${itemId}`]
        };
      });

      await checklistAPI.submitSupervisorReview(id, supervisorData);
      showToast('success', 'Supervisor review submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Supervisor submit error:', error);
      showToast('error', error.response?.data?.error || 'Failed to submit supervisor review');
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
      if (!previewImage) return;

      if (event.key === 'Escape') {
        setPreviewImage(null);
      } else if (event.key === 'ArrowLeft' && previewImages.length > 1) {
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : previewImages.length - 1;
        setCurrentImageIndex(newIndex);
        setPreviewImage(previewImages[newIndex]);
      } else if (event.key === 'ArrowRight' && previewImages.length > 1) {
        const newIndex = currentImageIndex < previewImages.length - 1 ? currentImageIndex + 1 : 0;
        setCurrentImageIndex(newIndex);
        setPreviewImage(previewImages[newIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, previewImages, currentImageIndex]);

  useEffect(() => {
    const fetchChecklistItems = async () => {
      try {
        setLoading(true);

        const checklistResponse = await checklistAPI.getChecklist(id);
        const checklistData = checklistResponse.data.checklist;
        setChecklist(checklistData);

        const response = await checklistAPI.getChecklistItems(id);
        setItems(response.data.items);

        // Use getSupervisorReviews instead of getChecklistResponses
        try {
          const reviewsResponse = await checklistAPI.getSupervisorReviews(id);
          if (reviewsResponse.data.reviews && reviewsResponse.data.reviews.length > 0) {
            const reviewFormData = {};
            const existingSupData = {};
            reviewsResponse.data.reviews.forEach(review => {
              // Set auditor's data
              reviewFormData[review.id] = {
                status: review.status,
                category: review.category,
                reason: review.reason,
                textbox: review.textbox || '',
                images: review.images || []
              };

              // Store existing supervisor data separately
              if (review.supervisor_item_status || review.supervisor_reason || review.supervisor_status || (review.supervisor_images && review.supervisor_images.length > 0)) {
                existingSupData[review.id] = {
                  supervisor_item_status: review.supervisor_item_status,
                  supervisor_reason: review.supervisor_reason,
                  supervisor_status: review.supervisor_status,
                  supervisor_images: review.supervisor_images || [],
                  manager_reason: review.manager_reason || null
                };
              }
            });
            setFormData(reviewFormData);
            setExistingSupervisorData(existingSupData);
          }
        } catch (reviewErr) {
          console.log('No reviews found');
        }

        // Fetch executive data for SC checklists
        if (checklistData?.type === 'SC') {
          try {
            console.log('Fetching executive data for checklist:', id, 'Type:', checklistData.type);
            const executiveRes = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/executive/checklist/${id}/data/auditor`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (executiveRes.ok) {
              const executiveResult = await executiveRes.json();
              const execMap = {};
              (executiveResult.data || []).forEach(row => { execMap[row.checklist_item_id] = row; });
              setExecutiveData(execMap);
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
    const ncItems = items.filter(item => (formData[item.id || items.indexOf(item)] || {}).status === 'No');
    const mobileItem = mobileActionModal !== null ? items.find(item => (item.id || items.indexOf(item)) === mobileActionModal) : null;
    const mobileItemId = mobileItem ? (mobileItem.id || items.indexOf(mobileItem)) : null;

    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-600">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate" style={{ fontSize: '16px' }}>{checklist?.checklist_name || `Checklist #${id}`}</p>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>{checklist?.location_name} • {checklist?.department_name}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
          {ncItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400" style={{ fontSize: '14px' }}>No non-conformance items found.</div>
          ) : ncItems.map((item, index) => {
            const itemId = item.id || index;
            const itemData = formData[itemId] || {};
            const isFilled = !!formData[`supervisor_item_status_${itemId}`] && !!formData[`supervisor_reason_${itemId}`] && !!formData[`supervisor_status_${itemId}`];
            return (
              <div key={itemId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer" onClick={() => setMobileActionModal(itemId)}>
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500" style={{ fontSize: '13px' }}>#{index + 1}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${item.criticality === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`} style={{ fontSize: '11px' }}>{item.criticality}</span>
                  </div>
                  {isFilled && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold" style={{ fontSize: '11px' }}>Filled</span>}
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Activity</p>
                    <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item.activities || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Process</p>
                    <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item.process || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Reason</p>
                    <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{itemData.reason || '-'}</p>
                  </div>
                </div>
                <div className="flex border-t border-gray-100">
                  <button onClick={() => setMobileActionModal(itemId)} className="mobile-btn-text flex-1 py-4 font-semibold text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-1.5">
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

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-10 flex justify-end">
          <button onClick={handleSupervisorSubmit} disabled={saving} className="mobile-btn-text px-8 py-2.5 font-semibold text-white bg-btn-primary rounded-xl disabled:opacity-50">
            {saving ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>

        {mobileActionModal !== null && mobileItem && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col">
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
              <button onClick={() => setMobileActionModal(null)} className="text-gray-600">
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <p className="font-bold text-gray-800" style={{ fontSize: '16px' }}>Action</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
              <div>
                <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Status *</label>
                <MobileSelect label="Status" value={formData[`supervisor_item_status_${mobileItemId}`] || ''} onChange={(val) => { setFormData(prev => ({ ...prev, [`supervisor_item_status_${mobileItemId}`]: val, [`supervisor_status_${mobileItemId}`]: '' })); setValidationErrors(prev => ({ ...prev, [`supervisor_item_status_${mobileItemId}`]: null })); }} options={[{ value: 'Open', label: 'Open' }, { value: 'Close', label: 'Close' }]} placeholder="Select Status" />
                {validationErrors[`supervisor_item_status_${mobileItemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_item_status_${mobileItemId}`]}</p>}
              </div>
              {formData[`supervisor_item_status_${mobileItemId}`] && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Reason *</label>
                  <textarea value={formData[`supervisor_item_reason_${mobileItemId}`] || ''} onChange={(e) => { setFormData(prev => ({ ...prev, [`supervisor_item_reason_${mobileItemId}`]: e.target.value })); setValidationErrors(prev => ({ ...prev, [`supervisor_item_reason_${mobileItemId}`]: null })); }} rows="3" placeholder="Enter reason..." className={`w-full px-3 py-2 border rounded-xl text-sm ${validationErrors[`supervisor_item_reason_${mobileItemId}`] ? 'border-red-500' : 'border-gray-300'}`} />
                  {validationErrors[`supervisor_item_reason_${mobileItemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_item_reason_${mobileItemId}`]}</p>}
                </div>
              )}
              <div>
                <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Proof of VA</label>
                {mobileItemId !== null && formData[mobileItemId]?.images?.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {formData[mobileItemId].images.map((image, i) => {
                      const imgUrl = image instanceof File ? URL.createObjectURL(image) : (image.url || buildImageUrl(image.name || image));
                      return (
                        <img key={i} src={imgUrl} alt={`va-${i}`} className="w-16 h-16 object-cover rounded-xl border cursor-pointer"
                          onClick={() => { const urls = formData[mobileItemId].images.map(img => img instanceof File ? URL.createObjectURL(img) : (img.url || buildImageUrl(img.name || img))); setPreviewImages(urls); setCurrentImageIndex(i); setPreviewImage(urls[i]); }} />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No auditor images</p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Proof of Supervisor</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center" onClick={() => document.getElementById(`sup-file-mob-${mobileItemId}`).click()}>
                  {formData[`supervisor_${mobileItemId}`]?.images?.length > 0 ? (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {formData[`supervisor_${mobileItemId}`].images.map((image, i) => (
                        <div key={i} className="relative">
                          <img src={image instanceof File ? URL.createObjectURL(image) : buildImageUrl(image.name || image)} alt={`sup-${i}`} className="w-16 h-16 object-cover rounded-xl border cursor-pointer" onClick={(e) => { e.stopPropagation(); const imgs = formData[`supervisor_${mobileItemId}`].images; const urls = imgs.map(img => img instanceof File ? URL.createObjectURL(img) : buildImageUrl(img.name || img)); setPreviewImages(urls); setCurrentImageIndex(i); setPreviewImage(urls[i]); }} />
                          <button type="button" onClick={(e) => { e.stopPropagation(); const newImgs = formData[`supervisor_${mobileItemId}`].images.filter((_, idx) => idx !== i); setFormData(prev => ({ ...prev, [`supervisor_${mobileItemId}`]: { ...prev[`supervisor_${mobileItemId}`], images: newImgs } })); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Tap to upload images</p>
                  )}
                  <input id={`sup-file-mob-${mobileItemId}`} type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleImageUpload(`supervisor_${mobileItemId}`, e.target.files)} />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Supervisor Reason *</label>
                <MobileSelect label="Supervisor Reason" value={formData[`supervisor_reason_${mobileItemId}`] || ''} onChange={(val) => { setFormData(prev => ({ ...prev, [`supervisor_reason_${mobileItemId}`]: val })); setValidationErrors(prev => ({ ...prev, [`supervisor_reason_${mobileItemId}`]: null })); }} options={SUPERVISOR_REASONS.map(r => ({ value: r.value, label: r.label }))} placeholder="Select Reason" />
                {validationErrors[`supervisor_reason_${mobileItemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_reason_${mobileItemId}`]}</p>}
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1" style={{ fontSize: '14px' }}>Status *</label>
                <MobileSelect label="Status" value={formData[`supervisor_status_${mobileItemId}`] || ''} onChange={(val) => { setFormData(prev => ({ ...prev, [`supervisor_status_${mobileItemId}`]: val })); setValidationErrors(prev => ({ ...prev, [`supervisor_status_${mobileItemId}`]: null })); }} options={[{ value: 'Accepted', label: 'Accepted' }, { value: 'Rejected', label: 'Rejected' }]} placeholder="Select Status" />
                {validationErrors[`supervisor_status_${mobileItemId}`] && <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_status_${mobileItemId}`]}</p>}
              </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3">
              <button onClick={() => setMobileActionModal(null)} className="mobile-btn-text w-full py-3 font-bold text-white bg-btn-primary rounded-xl">Done</button>
            </div>
            {previewImage && (
              <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200]" onClick={() => setPreviewImage(null)}>
                <div className="relative w-full h-full flex items-center justify-center">
                  <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                  <a href={previewImage} download className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10" onClick={e => e.stopPropagation()}>
                    <ArrowDownTrayIcon className="w-6 h-6" />
                  </a>
                  {previewImages.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); const ni = currentImageIndex > 0 ? currentImageIndex - 1 : previewImages.length - 1; setCurrentImageIndex(ni); setPreviewImage(previewImages[ni]); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronLeftIcon className="w-6 h-6" /></button>
                      <button onClick={(e) => { e.stopPropagation(); const ni = currentImageIndex < previewImages.length - 1 ? currentImageIndex + 1 : 0; setCurrentImageIndex(ni); setPreviewImage(previewImages[ni]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronRightIcon className="w-6 h-6" /></button>
                    </>
                  )}
                  <img src={previewImage} alt={`Preview ${currentImageIndex + 1}`} className="w-full h-full object-contain" onClick={e => e.stopPropagation()} />
                  {previewImages.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">{currentImageIndex + 1} / {previewImages.length}</div>
                  )}
                </div>
              </div>
            )}
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
                +�
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
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                {items.length > 0 ? items[0]?.type || 'Type' : 'Type'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.department_name || 'Department'}
              </span>
              <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                {checklist?.location_name || 'Location'}
              </span>

              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                {formatDate(new Date(checklist?.created_at))}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
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
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                NC High: {items.filter(item => item.criticality === 'High' && formData[item.id]?.status === 'No').length}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                NC Low: {items.filter(item => item.criticality === 'Low' && formData[item.id]?.status === 'No').length}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                NC Total: {items.filter(item => formData[item.id]?.status === 'No').length}
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
              <span className="font-medium text-gray-900">Non-Conformance Items</span>
              {showForm ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
            </button>
            {showForm && (
              <div className="p-4">
                {items.filter(item => {
                  const itemId = item.id || items.indexOf(item);
                  const itemData = formData[itemId] || {};
                  return itemData.status === 'No';
                }).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No non-conformance items found for review.
                  </div>
                ) : (
                  <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                    <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>
                              Activity
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '150px' }}>
                              Process
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>
                              Reason
                            </th>
                            {checklist?.type === 'SC' && (
                              <>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>
                                  Auditor Response
                                </th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '150px' }}>
                                  Executive Images
                                </th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '150px' }}>
                                  Executive Reason
                                </th>
                              </>
                            )}
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>
                              Status
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '300px' }}>
                              Proof of Supervisor
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '160px' }}>
                              Supervisor Reason
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.filter(item => {
                            const itemId = item.id || items.indexOf(item);
                            const itemData = formData[itemId] || {};
                            return itemData.status === 'No';
                          }).map((item, index) => {
                            const itemId = item.id || index;
                            const itemData = formData[itemId] || {};
                            const executiveResponse = executiveData[itemId];
                            const executiveImages = executiveResponse?.image_name?.split(',').filter(img => img) || [];
                            return (
                              <tr key={itemId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '200px' }}>
                                  {item.activities || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '150px' }}>
                                  {item.process || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                  {itemData.reason || '-'}
                                </td>
                                {checklist?.type === 'SC' && (
                                  <>
                                    <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                        {itemData.textbox || '-'}
                                      </td>
                                    <td className="px-4 py-3" style={{ minWidth: '150px' }}>
                                      {executiveImages.length > 0 ? (
                                        <div className="flex gap-1 items-center">
                                          {executiveImages.slice(0, 3).map((image, imgIndex) => (
                                            <img
                                              key={imgIndex}
                                              src={buildImageUrl(image)}
                                              alt={`Executive ${imgIndex + 1}`}
                                              className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                              onClick={() => {
                                                const imageUrls = executiveImages.map(img => buildImageUrl(img));
                                                setPreviewImages(imageUrls);
                                                setCurrentImageIndex(imgIndex);
                                                setPreviewImage(imageUrls[imgIndex]);
                                              }}
                                            />
                                          ))}
                                          {executiveImages.length > 3 && (
                                            <div
                                              className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                              onClick={() => {
                                                const imageUrls = executiveImages.map(img => buildImageUrl(img));
                                                setPreviewImages(imageUrls);
                                                setCurrentImageIndex(3);
                                                setPreviewImage(imageUrls[3]);
                                              }}
                                            >
                                              +{executiveImages.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-gray-500 text-sm">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '150px' }}>
                                      {executiveResponse?.reason || '-'}
                                    </td>
                                  </>
                                )}
                                <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                                  {/* Existing Supervisor Data */}
                                  {existingSupervisorData[itemId] && (
                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <div className="text-sm font-medium text-blue-800 mb-2">Previous Supervisor Review:</div>
                                      <div className="space-y-2 text-sm">
                                        <div><span className="font-medium">Status:</span> {existingSupervisorData[itemId].supervisor_item_status}</div>
                                        <div><span className="font-medium">Reason:</span> {existingSupervisorData[itemId].supervisor_reason}</div>
                                        <div><span className="font-medium">Decision:</span> {existingSupervisorData[itemId].supervisor_status}</div>
                                        {existingSupervisorData[itemId].supervisor_images && existingSupervisorData[itemId].supervisor_images.length > 0 && (
                                          <div>
                                            <span className="font-medium">Images:</span>
                                            <div className="flex gap-1 mt-1">
                                              {existingSupervisorData[itemId].supervisor_images.slice(0, 2).map((image, imgIndex) => (
                                                <img
                                                  key={imgIndex}
                                                  src={image instanceof File ? URL.createObjectURL(image) : `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${encodeURIComponent(image.name || image)}`}
                                                  alt={`Previous ${imgIndex + 1}`}
                                                  className="w-8 h-8 object-cover rounded border cursor-pointer"
                                                  onClick={() => {
                                                    const imageUrls = existingSupervisorData[itemId].supervisor_images.map(img => 
                                                      img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${encodeURIComponent(img.name || img)}`
                                                    );
                                                    setPreviewImages(imageUrls);
                                                    setCurrentImageIndex(imgIndex);
                                                    setPreviewImage(imageUrls[imgIndex]);
                                                  }}
                                                />
                                              ))}
                                              {existingSupervisorData[itemId].supervisor_images.length > 2 && (
                                                <div className="w-8 h-8 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600">
                                                  +{existingSupervisorData[itemId].supervisor_images.length - 2}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {existingSupervisorData[itemId].manager_reason && (
                                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                            <span className="font-medium text-red-800">Manager Rejection Reason:</span>
                                            <p className="text-sm text-red-700 mt-1">{existingSupervisorData[itemId].manager_reason}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* New Supervisor Form */}
                                  <div className="space-y-2">
                                    <select
                                      value={formData[`supervisor_item_status_${itemId}`] || ''}
                                      onChange={(e) => {
                                        setFormData(prev => ({ 
                                          ...prev, 
                                          [`supervisor_item_status_${itemId}`]: e.target.value,
                                          [`supervisor_status_${itemId}`]: '' // Clear dependent dropdown
                                        }));
                                        setValidationErrors(prev => ({ ...prev, [`supervisor_item_status_${itemId}`]: null }));
                                      }}
                                      className={`text-sm border rounded-md px-2 py-1 w-full ${validationErrors[`supervisor_item_status_${itemId}`] ? 'border-red-500' : 'border-gray-300'}`}
                                    >
                                      <option value="">select</option>
                                      <option value="Open">Open</option>
                                      <option value="Close">Close</option>
                                    </select>
                                    {validationErrors[`supervisor_item_status_${itemId}`] && (
                                      <p className="text-xs text-red-600">{validationErrors[`supervisor_item_status_${itemId}`]}</p>
                                    )}
                                    <textarea
                                      placeholder="Reason"
                                      value={formData[`supervisor_item_reason_${itemId}`] || ''}
                                      onChange={(e) => {
                                        setFormData(prev => ({ ...prev, [`supervisor_item_reason_${itemId}`]: e.target.value }));
                                        setValidationErrors(prev => ({ ...prev, [`supervisor_item_reason_${itemId}`]: null }));
                                      }}
                                      className={`w-full text-sm border rounded-md px-2 py-1 resize-none ${validationErrors[`supervisor_item_reason_${itemId}`] ? 'border-red-500' : 'border-gray-300'}`}
                                      rows="3"
                                    />
                                    {validationErrors[`supervisor_item_reason_${itemId}`] && (
                                      <p className="text-xs text-red-600">{validationErrors[`supervisor_item_reason_${itemId}`]}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '300px' }}>
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-sm font-medium text-gray-700 mb-2">Proof of VA</div>
                                      {itemData.images && itemData.images.length > 0 ? (
                                        <div className="flex gap-1 flex-wrap">
                                          {itemData.images.slice(0, 4).map((image, imgIndex) => (
                                            <div key={imgIndex} className="relative">
                                              <img
                                                src={image instanceof File ? URL.createObjectURL(image) : (image.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image.name || image)}`)}
                                                alt={`Auditor ${imgIndex + 1}`}
                                                className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                                onClick={() => {
                                                  const imageUrls = itemData.images.map(img =>
                                                    img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`)
                                                  );
                                                  setPreviewImages(imageUrls);
                                                  setCurrentImageIndex(imgIndex);
                                                  setPreviewImage(imageUrls[imgIndex]);
                                                }}
                                              />
                                            </div>
                                          ))}
                                          {itemData.images.length > 4 && (
                                            <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                              onClick={() => {
                                                const imageUrls = itemData.images.map(img =>
                                                  img instanceof File ? URL.createObjectURL(img) : (img.url || `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`)
                                                );
                                                setPreviewImages(imageUrls);
                                                setCurrentImageIndex(4);
                                                setPreviewImage(imageUrls[4]);
                                              }}>
                                              +{itemData.images.length - 4}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-gray-500 text-sm">No auditor images</div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-700 mb-2">Proof of Supervisor:</div>
                                      <div
                                        className="border-2 border-dashed rounded-lg p-2 cursor-pointer hover:bg-gray-50 min-h-[120px] max-h-[200px] overflow-y-auto border-gray-300"
                                        onClick={() => document.getElementById(`supervisor-file-${itemId}`).click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
                                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
                                        onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); if (files.length) handleImageUpload(`supervisor_${itemId}`, files); }}
                                      >
                                        <input
                                          type="file"
                                          multiple
                                          accept="image/*"
                                          onChange={(e) => handleImageUpload(`supervisor_${itemId}`, e.target.files)}
                                          className="hidden"
                                          id={`supervisor-file-${itemId}`}
                                        />
                                        {formData[`supervisor_${itemId}`]?.images && formData[`supervisor_${itemId}`].images.length > 0 ? (
                                          <div className="flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                            {formData[`supervisor_${itemId}`].images.slice(0, 3).map((image, imgIndex) => (
                                              <div key={imgIndex} className="relative group">
                                                <img
                                                  src={image instanceof File ? URL.createObjectURL(image) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image.name || image)}`}
                                                  alt={`Supervisor ${imgIndex + 1}`}
                                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                                  onClick={() => {
                                                    const imageUrls = formData[`supervisor_${itemId}`].images.map(img =>
                                                      img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`
                                                    );
                                                    setPreviewImages(imageUrls);
                                                    setCurrentImageIndex(imgIndex);
                                                    setPreviewImage(imageUrls[imgIndex]);
                                                  }}
                                                />
                                                <button
                                                  onClick={() => {
                                                    const newImages = formData[`supervisor_${itemId}`].images.filter((_, i) => i !== imgIndex);
                                                    setFormData(prev => ({ ...prev, [`supervisor_${itemId}`]: { ...prev[`supervisor_${itemId}`], images: newImages } }));
                                                  }}
                                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center opacity-80 group-hover:opacity-100"
                                                  title="Delete image"
                                                >
                                                  x
                                                </button>
                                              </div>
                                            ))}
                                            {formData[`supervisor_${itemId}`].images.length > 3 && (
                                              <div
                                                className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                                onClick={() => {
                                                  const imageUrls = formData[`supervisor_${itemId}`].images.map(img =>
                                                    img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`
                                                  );
                                                  setPreviewImages(imageUrls);
                                                  setCurrentImageIndex(3);
                                                  setPreviewImage(imageUrls[3]);
                                                }}
                                              >
                                                +{formData[`supervisor_${itemId}`].images.length - 3}
                                              </div>
                                            )}
                                            <div
                                              className="cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 rounded w-12 h-12 hover:border-gray-400 flex-shrink-0"
                                              onClick={() => document.getElementById(`supervisor-file-${itemId}`).click()}
                                            >
                                              <span className="text-xl text-gray-400">+</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm text-gray-600 text-center h-full flex items-center justify-center">
                                            <div>
                                              <p>Drag images or click to browse</p>
                                              <p className="text-xs text-gray-400 mt-1">Multiple files supported</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '160px' }}>
                                  <select
                                    value={formData[`supervisor_reason_${itemId}`] || ''}
                                    onChange={(e) => {
                                      setFormData(prev => ({ ...prev, [`supervisor_reason_${itemId}`]: e.target.value }));
                                      setValidationErrors(prev => ({ ...prev, [`supervisor_reason_${itemId}`]: null }));
                                    }}
                                    className={`text-sm border rounded-md px-2 py-1 w-full ${validationErrors[`supervisor_reason_${itemId}`] ? 'border-red-500' : 'border-gray-300'}`}
                                  >
                                    {SUPERVISOR_REASONS.map(reason => (
                                      <option key={reason.value} value={reason.value}>{reason.label}</option>
                                    ))}
                                  </select>
                                  {validationErrors[`supervisor_reason_${itemId}`] && (
                                    <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_reason_${itemId}`]}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                                  <select
                                    value={formData[`supervisor_status_${itemId}`] || ''}
                                    onChange={(e) => {
                                      setFormData(prev => ({ ...prev, [`supervisor_status_${itemId}`]: e.target.value }));
                                      setValidationErrors(prev => ({ ...prev, [`supervisor_status_${itemId}`]: null }));
                                    }}
                                    className={`text-sm border rounded-md px-2 py-1 w-full ${validationErrors[`supervisor_status_${itemId}`] ? 'border-red-500' : 'border-gray-300'}`}
                                  >
                                    <option value="">Select</option>
                                      <>
                                        <option value="Accepted">Accepted</option>
                                        <option value="Rejected">Rejected</option>
                                      </>
                                  </select>
                                  {validationErrors[`supervisor_status_${itemId}`] && (
                                    <p className="text-xs text-red-600 mt-1">{validationErrors[`supervisor_status_${itemId}`]}</p>
                                  )}
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
              onClick={handleSupervisorSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg flex items-center space-x-2 hover:opacity-90 transition-all duration-200"
            >
              {saving ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>

      {/* Image Gallery Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <a
              href={previewImage}
              download
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </a>

            {previewImages.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : previewImages.length - 1;
                    setCurrentImageIndex(newIndex);
                    setPreviewImage(previewImages[newIndex]);
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newIndex = currentImageIndex < previewImages.length - 1 ? currentImageIndex + 1 : 0;
                    setCurrentImageIndex(newIndex);
                    setPreviewImage(previewImages[newIndex]);
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            <img
              src={previewImage}
              alt={`Preview ${currentImageIndex + 1}`}
              className="w-full h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {previewImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {currentImageIndex + 1} / {previewImages.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorChecklistForm;
