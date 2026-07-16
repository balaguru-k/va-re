import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { checklistAPI } from '../services/api';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, DocumentArrowDownIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const ManagerChecklistView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({});
  const [supervisorReviews, setSupervisorReviews] = useState({});
  const [managerReviews, setManagerReviews] = useState({});
  const [executiveData, setExecutiveData] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

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
    const fetchChecklistData = async () => {
      try {
        setLoading(true);
        
        const checklistResponse = await checklistAPI.getChecklist(id);
        setChecklist(checklistResponse.data.checklist);
        
        const itemsResponse = await checklistAPI.getChecklistItems(id);
        setItems(itemsResponse.data.items);
        
        try {
          const responsesResponse = await checklistAPI.getChecklistResponses(id);
          if (responsesResponse.data.responses?.length > 0) {
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
        } catch (err) {
          // No responses found
        }

        try {
          const supervisorResponse = await checklistAPI.getAllSupervisorReviews(id);
          if (supervisorResponse.data.reviews?.length > 0) {
            const supervisorData = {};
            supervisorResponse.data.reviews.forEach(review => {
              supervisorData[review.checklist_item_id] = {
                reason: review.reason,
                status: review.supervisor_status,
                images: review.supervisor_images ? review.supervisor_images.split(',') : []
              };
            });
            setSupervisorReviews(supervisorData);
          }
        } catch (err) {
          // No supervisor reviews found
        }

        try {
          const managerResponse = await checklistAPI.getManagerReviews(id);
          if (managerResponse.data.reviews?.length > 0) {
            const managerData = {};
            managerResponse.data.reviews.forEach(review => {
              managerData[review.checklist_item_id] = {
                reason: review.reason,
                status: review.manager_status
              };
            });
            setManagerReviews(managerData);
          }
        } catch (err) {
          // No manager reviews found
        }
        
        // Fetch executive data for SC checklists
        if (checklistResponse.data.checklist?.type === 'SC') {
          try {
            const executiveRes = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/executive/checklist/${id}/data/auditor`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });
            if (executiveRes.ok) { const executiveResult = await executiveRes.json(); const execMap = {}; (executiveResult.data || []).forEach(row => { execMap[row.checklist_item_id] = row; }); setExecutiveData(execMap); }
          } catch (error) {
            console.error('Error fetching executive data:', error);
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch checklist data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChecklistData();
    }
  }, [id]);

  const getStatusBadge = (status) => {
    const statusClasses = {
      'Yes': 'bg-green-100 text-green-800',
      'No': 'bg-red-100 text-red-800',
      'NA': 'bg-gray-100 text-gray-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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

  const hasNoItems = items.some((item, i) => (formData[item.id || i] || {}).status === 'No');
  const displayItems = hasNoItems ? items.filter((item, i) => (formData[item.id || i] || {}).status === 'No') : items;

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-600">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate" style={{ fontSize: '16px' }}>{checklist?.checklist_name || `Checklist #${id}`}</p>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>{checklist?.location_name} • {checklist?.department_name}</p>
          </div>
          {checklist?.status && (
            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold" style={{ fontSize: '11px' }}>{checklist.status}</span>
          )}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
          {displayItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400" style={{ fontSize: '14px' }}>No items found.</div>
          ) : displayItems.map((item, index) => {
            const itemId = item.id || index;
            const itemData = formData[itemId] || {};
            const supervisorData = supervisorReviews[itemId] || {};
            const managerData = managerReviews[itemId] || {};
            const auditorImages = itemData.images || [];
            const supervisorImages = supervisorData.images || [];

            return (
              <div key={itemId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500" style={{ fontSize: '13px' }}>#{index + 1}</span>
                    {item.criticality && <span className={`px-2 py-0.5 rounded-full font-semibold ${item.criticality === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`} style={{ fontSize: '11px' }}>{item.criticality}</span>}
                  </div>
                  {managerData.status && (
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${managerData.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} style={{ fontSize: '11px' }}>{managerData.status}</span>
                  )}
                </div>

                <div className="px-4 py-3 space-y-3">
                  {/* Activity & Process */}
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

                  {/* Auditor Response */}
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="font-semibold text-gray-600" style={{ fontSize: '12px' }}>AUDITOR RESPONSE</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Status</p>
                        {itemData.status ? getStatusBadge(itemData.status) : <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>-</p>}
                      </div>
                      {itemData.category && (
                        <div>
                          <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Category</p>
                          <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{itemData.category}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Reason</p>
                        <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{itemData.reason || '-'}</p>
                      </div>
                      {checklist?.type === 'SC' && itemData.textbox && (
                        <div className="col-span-2">
                          <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Response</p>
                          <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{itemData.textbox}</p>
                        </div>
                      )}
                    </div>
                    {auditorImages.length > 0 && (
                      <div>
                        <p className="text-gray-400 mb-1" style={{ fontSize: '11px' }}>Images</p>
                        <div className="flex gap-2 flex-wrap">
                          {auditorImages.slice(0, 4).map((image, imgIndex) => {
                            const url = image instanceof File ? URL.createObjectURL(image) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image.name || image)}`;
                            return <img key={imgIndex} src={url} alt={`a-${imgIndex}`} className="w-14 h-14 object-cover rounded-lg border cursor-pointer" onClick={() => { const urls = auditorImages.map(img => img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`); setSelectedImages(urls); setCurrentImageIndex(imgIndex); setShowImageModal(true); }} />;
                          })}
                          {auditorImages.length > 4 && <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer" onClick={() => { const urls = auditorImages.map(img => img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`); setSelectedImages(urls); setCurrentImageIndex(0); setShowImageModal(true); }}>+{auditorImages.length - 4}</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supervisor Response */}
                  <div className="border-t border-gray-100 pt-3 space-y-2">
                    <p className="font-semibold text-gray-600" style={{ fontSize: '12px' }}>SUPERVISOR RESPONSE</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Status</p>
                        {supervisorData.status ? getStatusBadge(supervisorData.status) : <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>-</p>}
                      </div>
                      <div>
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Reason</p>
                        <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{supervisorData.reason || '-'}</p>
                      </div>
                    </div>
                    {supervisorImages.length > 0 && (
                      <div>
                        <p className="text-gray-400 mb-1" style={{ fontSize: '11px' }}>Images</p>
                        <div className="flex gap-2 flex-wrap">
                          {supervisorImages.slice(0, 4).map((image, imgIndex) => {
                            const url = `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image)}`;
                            return <img key={imgIndex} src={url} alt={`s-${imgIndex}`} className="w-14 h-14 object-cover rounded-lg border cursor-pointer" onClick={() => { const urls = supervisorImages.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img)}`); setSelectedImages(urls); setCurrentImageIndex(imgIndex); setShowImageModal(true); }} />;
                          })}
                          {supervisorImages.length > 4 && <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer" onClick={() => { const urls = supervisorImages.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img)}`); setSelectedImages(urls); setCurrentImageIndex(0); setShowImageModal(true); }}>+{supervisorImages.length - 4}</div>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manager Decision */}
                  {(managerData.status || managerData.reason) && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="font-semibold text-gray-600" style={{ fontSize: '12px' }}>MANAGER DECISION</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Status</p>
                          {managerData.status ? getStatusBadge(managerData.status) : <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>-</p>}
                        </div>
                        {managerData.reason && (
                          <div>
                            <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Reason</p>
                            <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{managerData.reason}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Image Modal */}
        {showImageModal && selectedImages.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[200]" onClick={() => setShowImageModal(false)}>
            <div className="relative w-full h-full flex items-center justify-center">
              <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><XMarkIcon className="w-6 h-6" /></button>
              <button onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = selectedImages[currentImageIndex]; link.download = `image-${currentImageIndex + 1}.jpg`; link.click(); }} className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ArrowDownTrayIcon className="w-6 h-6" /></button>
              {selectedImages.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronLeftIcon className="w-6 h-6" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10"><ChevronRightIcon className="w-6 h-6" /></button>
                </>
              )}
              <img src={selectedImages[currentImageIndex]} alt={`Preview ${currentImageIndex + 1}`} className="w-full h-full object-contain" onClick={e => e.stopPropagation()} />
              {selectedImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">{currentImageIndex + 1} / {selectedImages.length}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
              {checklist?.checklist_name || `Checklist ID: ${id}`}
            </h1>
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800">
              {items.length > 0 ? items[0]?.type || 'Checklist' : 'Checklist'}
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
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
              {checklist?.status || 'Completed'}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-white border border-purple-100 rounded-lg overflow-hidden">
            <div className="overflow-auto" style={{maxHeight: '600px'}}>
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activity</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor Response</th>
                    {checklist?.type === 'SC' && (
                      <>
                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Executive Images</th>
                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Executive Reason</th>
                      </>
                    )}
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Supervisor Reason</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Supervisor Status</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Manager Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayItems.map((item, index) => {
                    const itemId = item.id || index;
                    const itemData = formData[itemId] || {};
                    const supervisorData = supervisorReviews[itemId] || {};
                    const managerData = managerReviews[itemId] || {};
                    const executiveResponse = executiveData[itemId];
                    const executiveImages = executiveResponse?.image_name?.split(',').filter(img => img) || [];
                    
                    return (
                      <tr key={itemId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.activities || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.process || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(itemData.status)}
                              {itemData.category && (
                                <span className="text-xs text-gray-600">({itemData.category})</span>
                              )}
                            </div>
                            {itemData.reason && (
                              <div className="text-sm text-gray-900"><span className="font-medium text-gray-700">Reason: </span>{itemData.reason}</div>
                            )}
                            {checklist?.type === 'SC' && itemData.textbox && (
                              <div className="text-sm text-gray-900"><span className="font-medium text-gray-700">Response: </span>{itemData.textbox}</div>
                            )}
                            {itemData.images?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {itemData.images.slice(0, 3).map((image, imgIndex) => (
                                  <img
                                    key={imgIndex}
                                    src={image instanceof File ? URL.createObjectURL(image) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image.name || image)}`}
                                    alt={`Auditor ${imgIndex + 1}`}
                                    className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => {
                                      const imageUrls = itemData.images.map(img => 
                                        img instanceof File ? URL.createObjectURL(img) : `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img.name || img)}`
                                      );
                                      setSelectedImages(imageUrls);
                                      setCurrentImageIndex(imgIndex);
                                      setShowImageModal(true);
                                    }}
                                  />
                                ))}
                                {itemData.images.length > 3 && (
                                  <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600">
                                    +{itemData.images.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        {checklist?.type === 'SC' && (
                          <>
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {executiveResponse?.reason || '-'}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            {supervisorData.reason && (
                              <div className="text-sm text-gray-900">{supervisorData.reason}</div>
                            )}
                            {supervisorData.images?.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {supervisorData.images.slice(0, 3).map((image, imgIndex) => (
                                  <img
                                    key={imgIndex}
                                    src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(image)}`}
                                    alt={`Supervisor ${imgIndex + 1}`}
                                    className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                    onClick={() => {
                                      const imageUrls = supervisorData.images.map(img => `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${encodeURIComponent(img)}`);
                                      setSelectedImages(imageUrls);
                                      setCurrentImageIndex(imgIndex);
                                      setShowImageModal(true);
                                    }}
                                  />
                                ))}
                                {supervisorData.images.length > 3 && (
                                  <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600">
                                    +{supervisorData.images.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {supervisorData.status ? getStatusBadge(supervisorData.status) : <span className="text-gray-500 text-sm">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-2">
                            {managerData.status && getStatusBadge(managerData.status)}
                            {managerData.reason && (
                              <div className="text-sm text-gray-900">{managerData.reason}</div>
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
        </div>
      </div>

      {/* Image Modal */}
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
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = selectedImages[currentImageIndex];
                link.download = `image-${currentImageIndex + 1}.jpg`;
                link.click();
              }}
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
            >
              <span className="w-6 h-6 flex items-center justify-center text-2xl font-bold">↓</span>
            </button>
            
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

export default ManagerChecklistView;