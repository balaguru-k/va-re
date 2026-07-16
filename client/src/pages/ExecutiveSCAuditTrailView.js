import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { executiveAPI } from '../services/api';

const ExecutiveSCAuditTrailView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showImageModal) return;
      if (e.key === 'Escape') {
        setShowImageModal(false);
      } else if (e.key === 'ArrowLeft' && selectedImages.length > 1) {
        setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1);
      } else if (e.key === 'ArrowRight' && selectedImages.length > 1) {
        setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages.length]);

  useEffect(() => {
    fetchAuditTrailDetails();
  }, [id]);

  const fetchAuditTrailDetails = async () => {
    try {
      setLoading(true);
      const response = await executiveAPI.getSCAuditTrailDetails(id);
      
      // Merge all data by activities text (executive uses template items, auditor uses daily items)
      const mergedData = {};

      // Add auditor data first (keyed by activities)
      response.data.auditor_data?.forEach(item => {
        const key = item.activities || item.checklist_item_id;
        if (!mergedData[key]) mergedData[key] = {};
        mergedData[key].auditor = item;
      });

      // Add executive data — match by activities
      response.data.executive_data?.forEach(item => {
        const key = item.activities || item.checklist_item_id;
        if (!mergedData[key]) mergedData[key] = {};
        mergedData[key].executive = item;
      });

      // Add supervisor data
      response.data.supervisor_data?.forEach(item => {
        // find matching auditor row by checklist_item_id
        const auditorRow = response.data.auditor_data?.find(a => a.checklist_item_id === item.checklist_item_id);
        const key = auditorRow?.activities || item.checklist_item_id;
        if (!mergedData[key]) mergedData[key] = {};
        mergedData[key].supervisor = item;
      });

      // Add manager data
      response.data.manager_data?.forEach(item => {
        const auditorRow = response.data.auditor_data?.find(a => a.checklist_item_id === item.checklist_item_id);
        const key = auditorRow?.activities || item.checklist_item_id;
        if (!mergedData[key]) mergedData[key] = {};
        mergedData[key].manager = item;
      });

      setData({
        ...response.data,
        mergedData: Object.entries(mergedData).map(([key, data]) => ({ key, ...data }))
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch audit trail details');
    } finally {
      setLoading(false);
    }
  };

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
    <div className="p-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <button onClick={() => navigate('/executive/sc-audit-trail')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
              {(data?.checklist?.checklist_name || '').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
              {data?.checklist?.location_name}
            </span>
            <span className="text-gray-400">•</span>
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
              {data?.checklist?.department_name}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
            <div style={{maxHeight: '800px', overflowY: 'auto'}}>
              <div style={{overflowX: 'auto'}}>
                <table className="min-w-full">
                <thead style={{backgroundColor: '#ededed'}} className="border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Activities</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Process</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Executive Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Executive Images</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor Response</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor Images</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supervisor Reason</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supervisor Images</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supervisor Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Manager Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.mergedData && data.mergedData.length > 0 ? (
                    data.mergedData.map((row, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.auditor?.activities || row.executive?.activities || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.auditor?.process || row.executive?.process || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.auditor?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              row.auditor.status === 'Yes' 
                                ? 'bg-green-100 text-green-800' 
                                : row.auditor.status === 'No'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {row.auditor.status}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.executive?.reason || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {row.executive?.image_name ? (
                            <div className="flex gap-1 items-center">
                              {row.executive.image_name.split(',').slice(0, 3).map((img, idx) => (
                                <img
                                  key={idx}
                                  src={`${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`}
                                  alt={`Exec ${idx + 1}`}
                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-75 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.executive.image_name.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(idx);
                                    setShowImageModal(true);
                                  }}
                                />
                              ))}
                              {row.executive.image_name.split(',').length > 3 && (
                                <div 
                                  className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.executive.image_name.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(3);
                                    setShowImageModal(true);
                                  }}
                                >
                                  +{row.executive.image_name.split(',').length - 3}
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.auditor?.reason || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.auditor?.textbox || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {row.auditor?.image_name ? (
                            <div className="flex gap-1 items-center">
                              {row.auditor.image_name.split(',').slice(0, 3).map((img, idx) => (
                                <img
                                  key={idx}
                                  src={`${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`}
                                  alt={`Auditor ${idx + 1}`}
                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-75 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.auditor.image_name.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(idx);
                                    setShowImageModal(true);
                                  }}
                                />
                              ))}
                              {row.auditor.image_name.split(',').length > 3 && (
                                <div 
                                  className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.auditor.image_name.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(3);
                                    setShowImageModal(true);
                                  }}
                                >
                                  +{row.auditor.image_name.split(',').length - 3}
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row.supervisor?.reason || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {row.supervisor?.supervisor_images ? (
                            <div className="flex gap-1 items-center">
                              {row.supervisor.supervisor_images.split(',').slice(0, 3).map((img, idx) => (
                                <img
                                  key={idx}
                                  src={`${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`}
                                  alt={`Supervisor ${idx + 1}`}
                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-75 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.supervisor.supervisor_images.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(idx);
                                    setShowImageModal(true);
                                  }}
                                />
                              ))}
                              {row.supervisor.supervisor_images.split(',').length > 3 && (
                                <div 
                                  className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                  onClick={() => {
                                    const images = row.supervisor.supervisor_images.split(',').map(img => 
                                      `${process.env.REACT_APP_BACKEND_URL || ''}/uploads/images/${img.trim()}`
                                    );
                                    setSelectedImages(images);
                                    setCurrentImageIndex(3);
                                    setShowImageModal(true);
                                  }}
                                >
                                  +{row.supervisor.supervisor_images.split(',').length - 3}
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.supervisor?.supervisor_status ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              row.supervisor.supervisor_status === 'Accepted' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {row.supervisor.supervisor_status}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {row.manager?.manager_status ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              row.manager.manager_status === 'Approved' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {row.manager.manager_status}
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
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

export default ExecutiveSCAuditTrailView;
