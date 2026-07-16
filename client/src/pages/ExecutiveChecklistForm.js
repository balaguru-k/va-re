import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI, executiveAPI } from '../services/api';
import { ChevronUpIcon, ChevronDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { getCriticalityBadgeClass } from '../utils/checklistUtils';
import { formatDate } from '../utils/dateFormatter';
import Swal from 'sweetalert2';
import showToast from '../utils/toast';

const ExecutiveChecklistForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(true);
  const [imageModal, setImageModal] = useState({ show: false, src: '', alt: '' });
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  const handleImageView = (imageSrc) => {
    setImageModal({ show: true, src: imageSrc, alt: 'Checklist Image' });
  };

  const closeImageModal = () => {
    setImageModal({ show: false, src: '', alt: '' });
  };

  const handleReasonChange = (itemId, reason) => {
    setFormData(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], reason }
    }));
  };

  const handleImageUpload = (itemId, files) => {
    setFormData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        images: [...(prev[itemId]?.images || []), ...Array.from(files)]
      }
    }));
  };

  const removeImage = (itemId, imageIndex) => {
    setFormData(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        images: prev[itemId]?.images?.filter((_, index) => index !== imageIndex) || []
      }
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await executiveAPI.saveChecklist(id, formData);
      
      // Fetch saved data after successful save
      try {
        const savedDataResponse = await executiveAPI.getExecutiveData(id);
        if (savedDataResponse.data.data && savedDataResponse.data.data.length > 0) {
          const savedFormData = {};
          savedDataResponse.data.data.forEach(response => {
            savedFormData[response.checklist_item_id] = {
              reason: response.reason,
              images: response.image_name ? response.image_name.split(',').map(name => ({ name })) : []
            };
          });
          setFormData(savedFormData);
        }
      } catch (fetchErr) {
        // No saved data found
      }
      
      showToast('success', 'Checklist saved successfully!');
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
      await executiveAPI.completeChecklist(id, formData);
      showToast('sucess', 'checklist completed successfully!')
      navigate('/executive/checklist-data');
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to complete checklist!');
    } finally {
      setSaving(false);
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
        
        // Fetch checklist details
        const checklistResponse = await checklistAPI.getChecklist(id);
        const checklistData = checklistResponse.data.checklist;
        setChecklist(checklistData);
        
        // Fetch checklist items
        const response = await checklistAPI.getChecklistItems(id);
        setItems(response.data.items);
        
        // Fetch existing draft data
        try {
          const draftDataResponse = await executiveAPI.getExecutiveData(id);
          if (draftDataResponse.data.data && draftDataResponse.data.data.length > 0) {
            const draftFormData = {};
            draftDataResponse.data.data.forEach(response => {
              draftFormData[response.checklist_item_id] = {
                reason: response.reason,
                images: response.image_name ? response.image_name.split(',').map(name => ({ name })) : []
              };
            });
            setFormData(draftFormData);
          }
        } catch (draftErr) {
          // No draft data found
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
                {checklist?.checklist_name || `Checklist ID: ${id}`}
              </h1>
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                {checklist?.checklist_type || 'SC'}
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
                  {formatDate(checklist?.assigned_date || new Date())}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                  High: {items.filter(item => item.criticality === 'High').length}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                  Low: {items.filter(item => item.criticality === 'Low').length}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  Total: {items.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg mb-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
            >
              <span className="font-medium text-gray-900">Checklist Items</span>
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
                    <div className="overflow-auto" style={{maxHeight: '600px'}}>
                      <table className="min-w-full">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '200px'}}>
                              Activities
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '120px'}}>
                              Process
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '180px'}}>
                              Reason
                            </th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{minWidth: '200px'}}>
                              Images
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item, index) => (
                            <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-3 text-sm text-gray-900" style={{minWidth: '200px'}}>
                                <div className="flex items-center gap-2">
                                  {item.activities || '-'} &nbsp;
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                                    {item.criticality || 'N/A'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900" style={{minWidth: '120px'}}>
                                {item.process || '-'}
                              </td>
                              <td className="px-4 py-3" style={{minWidth: '180px'}}>
                                <input
                                  type="text"
                                  value={formData[item.id || index]?.reason || ''}
                                  onChange={(e) => handleReasonChange(item.id || index, e.target.value)}
                                  placeholder="Enter reason..."
                                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-2"
                                />
                              </td>
                              <td className="px-4 py-3" style={{minWidth: '200px'}}>
                                <div className="space-y-2">
                                  {formData[item.id || index]?.images && formData[item.id || index].images.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mb-2">
                                      {formData[item.id || index].images.length > 4 && (
                                        <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                             onClick={() => {
                                               const imageUrls = formData[item.id || index].images.map(img => 
                                                 img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`
                                               );
                                               setPreviewImages(imageUrls);
                                               setCurrentImageIndex(4);
                                               setPreviewImage(imageUrls[4]);
                                             }}>
                                          +{formData[item.id || index].images.length - 4}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div
                                    className="border-2 border-dashed rounded-lg p-2 cursor-pointer hover:bg-gray-50 min-h-[120px] max-h-[200px] overflow-y-auto border-gray-300"
                                    onClick={() => document.getElementById(`file-${item.id || index}`).click()}
                                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50'); }}
                                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); }}
                                    onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50'); if (e.dataTransfer.files.length) handleImageUpload(item.id || index, e.dataTransfer.files); }}
                                  >
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onChange={(e) => handleImageUpload(item.id || index, e.target.files)}
                                      className="hidden"
                                      id={`file-${item.id || index}`}
                                    />
                                    {formData[item.id || index]?.images && formData[item.id || index].images.length > 0 ? (
                                      <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                                        {formData[item.id || index].images.map((image, imgIndex) => (
                                          <div key={imgIndex} className="relative group">
                                            <img
                                              src={image instanceof File ? URL.createObjectURL(image) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${image.name || image}`}
                                              alt={`Upload ${imgIndex + 1}`}
                                              className="w-full h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                                              onClick={() => {
                                                const imageUrls = formData[item.id || index].images.map(img => 
                                                  img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${img.name || img}`
                                                );
                                                setPreviewImages(imageUrls);
                                                setCurrentImageIndex(imgIndex);
                                                setPreviewImage(imageUrls[imgIndex]);
                                              }}
                                            />
                                            <button
                                              onClick={() => removeImage(item.id || index, imgIndex)}
                                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center opacity-80 group-hover:opacity-100"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        ))}
                                        <div
                                          className="cursor-pointer flex items-center justify-center border-2 border-dashed border-gray-300 rounded h-16 hover:border-gray-400"
                                          onClick={() => document.getElementById(`file-${item.id || index}`).click()}
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
                              </td>
                            </tr>
                          ))}
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
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg flex items-center space-x-2 hover:opacity-90 transition-all duration-200"
            >
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button
              onClick={handleComplete}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-lg flex items-center space-x-2 hover:opacity-90 transition-all duration-200">
              {saving ? 'Processing...' : 'Complete Checklist'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Image Gallery Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            
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
              className="rounded-lg shadow-2xl"
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

export default ExecutiveChecklistForm;