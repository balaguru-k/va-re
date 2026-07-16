import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { checklistAPI, executiveAPI } from '../services/api';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { getCriticalityBadgeClass } from '../utils/checklistUtils';
import { formatDate } from '../utils/dateFormatter';

const ExecutiveViewChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryDate = new URLSearchParams(location.search).get('date');
  const [items, setItems] = useState([]);
  const [checklist, setChecklist] = useState(null);
  const [executiveData, setExecutiveData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [previewImages, setPreviewImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [checklistResponse, itemsResponse, executiveResponse] = await Promise.all([
          checklistAPI.getChecklist(id),
          checklistAPI.getChecklistItems(id),
          executiveAPI.getExecutiveData(id, queryDate)
        ]);
        
        setChecklist(checklistResponse.data.checklist);
        setItems(itemsResponse.data.items);
        
        if (executiveResponse.data.data && executiveResponse.data.data.length > 0) {
          const dataMap = {};
          executiveResponse.data.data.forEach(response => {
            dataMap[response.checklist_item_id] = {
              reason: response.reason,
              images: response.image_name ? response.image_name.split(',') : []
            };
          });
          setExecutiveData(dataMap);
        }
        
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch checklist data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id, queryDate]);

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
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
              {checklist?.checklist_name || `Checklist ID: ${id}`}
            </h1>
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
              {items.length > 0 ? items[0]?.type || 'SC' : 'SC'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {checklist?.assigned_date ? formatDate(checklist.assigned_date) : new Date(checklist?.created_at).toLocaleDateString()}
                </span>
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
              {checklist?.department_name || 'Department'}
            </span>
            <span className="text-gray-400">•</span>
            <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
              {checklist?.location_name || 'Location'}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-auto" style={{maxHeight: '600px'}}>
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activities</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Reason</th>
                    <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Images</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const itemData = executiveData[item.id] || {};
                    return (
                      <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {item.activities || '-'}
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                              {item.criticality || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.process || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{itemData.reason || '-'}</td>
                        <td className="px-4 py-3">
                          {itemData.images && itemData.images.length > 0 ? (
                            <div className="flex gap-1 flex-wrap">
                              {itemData.images.slice(0, 4).map((imageName, imgIndex) => (
                                <img
                                  key={imgIndex}
                                  src={`${process.env.REACT_APP_BACKEND_URL}/uploads/images/${imageName}`}
                                  alt={`Executive ${imgIndex + 1}`}
                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                  onClick={() => {
                                    const imageUrls = itemData.images.map(name => 
                                      `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${name}`
                                    );
                                    setPreviewImages(imageUrls);
                                    setCurrentImageIndex(imgIndex);
                                    setPreviewImage(imageUrls[imgIndex]);
                                  }}
                                />
                              ))}
                              {itemData.images.length > 4 && (
                                <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                     onClick={() => {
                                       const imageUrls = itemData.images.map(name => 
                                         `${process.env.REACT_APP_BACKEND_URL}/uploads/images/${name}`
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
                            <span className="text-gray-500 text-sm">No images</span>
                          )}
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

export default ExecutiveViewChecklist;