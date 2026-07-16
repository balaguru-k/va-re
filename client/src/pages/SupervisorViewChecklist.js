import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, DocumentArrowDownIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { checklistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getCriticalityBadgeClass, buildImageUrl, getStatusBadgeClass, formatTime } from '../utils/checklistUtils';

const SupervisorViewChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checklistData, setChecklistData] = useState(null);
  const [items, setItems] = useState([]);
  const [responses, setResponses] = useState({});
  const [supervisorReviews, setSupervisorReviews] = useState({});
  const [managerReviews, setManagerReviews] = useState({});
  const [executiveData, setExecutiveData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showForm, setShowForm] = useState(true);

  useEffect(() => {
    fetchChecklistData();
  }, [id]);

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

  const fetchChecklistData = async () => {
    try {
      setLoading(true);
      const [checklistRes, itemsRes, responsesRes, supervisorRes] = await Promise.all([
        checklistAPI.getChecklist(id),
        checklistAPI.getChecklistItems(id),
        checklistAPI.getChecklistResponses(id),
        checklistAPI.getAllSupervisorReviews(id)
      ]);

      setChecklistData(checklistRes.data.checklist);

      const sortedItems = (itemsRes.data.items || []).sort((a, b) => a.id - b.id);
      setItems(sortedItems);

      const responsesMap = {};
      responsesRes.data.responses.forEach(r => {
        responsesMap[r.checklist_item_id] = r;
      });
      setResponses(responsesMap);

      const supervisorMap = {};
      supervisorRes.data.reviews.forEach(r => {
        supervisorMap[r.checklist_item_id] = r;
      });
      setSupervisorReviews(supervisorMap);

      // Fetch manager reviews separately
      try {
        const managerRes = await checklistAPI.getManagerReviews(id);
        const managerMap = {};
        (managerRes.data.reviews || []).forEach(r => {
          managerMap[r.checklist_item_id] = r;
        });
        setManagerReviews(managerMap);
      } catch (error) {
        console.error('Error fetching manager reviews:', error);
        setManagerReviews({});
      }

      // Fetch executive data for SC checklists
      if (checklistRes.data.checklist?.type === 'SC') {
        try {
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
    } catch (error) {
      // Error fetching checklist data
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded ${getStatusBadgeClass(status)}`}>
        ★ {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const ncItems = Object.values(supervisorReviews);
    const hasNoNCs = ncItems.length === 0;

    return (
      <div className="flex flex-col min-h-screen bg-gray-100">

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-gray-600">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate" style={{ fontSize: '16px' }}>{checklistData?.checklist_name || `Checklist #${id}`}</p>
            <p className="text-gray-400" style={{ fontSize: '12px' }}>{checklistData?.location_name} • {checklistData?.department_name}</p>
          </div>
          {checklistData?.status && (
            <span className={`px-2 py-1 rounded-full font-semibold ${getStatusBadgeClass(checklistData.status)}`} style={{ fontSize: '11px' }}>{checklistData.status}</span>
          )}
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-6">
          {hasNoNCs ? (
            <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
              <p className="text-green-700 font-semibold" style={{ fontSize: '14px' }}>✓ Completed without NCs — All items passed</p>
            </div>
          ) : ncItems.map((supervisorReview, index) => {
            const item = items.find(i => i.id === supervisorReview.checklist_item_id);
            const response = responses[supervisorReview.checklist_item_id];
            const auditorImages = response?.image_name?.split(',').filter(img => img) || [];
            const supervisorImages = supervisorReview?.supervisor_images?.split(',').filter(img => img) || [];
            const managerReview = managerReviews[supervisorReview.checklist_item_id];

            return (
              <div key={supervisorReview.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-500" style={{ fontSize: '13px' }}>#{index + 1}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${item?.criticality === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`} style={{ fontSize: '11px' }}>{item?.criticality}</span>
                  </div>
                  {supervisorReview?.supervisor_status && (
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${supervisorReview.supervisor_status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} style={{ fontSize: '11px' }}>{supervisorReview.supervisor_status}</span>
                  )}
                </div>

                {/* Key-value fields */}
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Activity</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item?.activities || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Process</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{item?.process || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Auditor Reason</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{response?.reason || '-'}</p>
                    </div>
                  </div>

                  {/* Supervisor section */}
                  <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Supervisor Status</p>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${supervisorReview?.status === 'Close' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`} style={{ fontSize: '12px' }}>{supervisorReview?.status || '-'}</span>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Reason Category</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{supervisorReview?.reason_category || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Supervisor Reason</p>
                      <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{supervisorReview?.reason || '-'}</p>
                    </div>
                  </div>

                  {/* Images */}
                  {(auditorImages.length > 0 || supervisorImages.length > 0) && (
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      {auditorImages.length > 0 && (
                        <div>
                          <p className="text-gray-400 mb-1" style={{ fontSize: '11px' }}>Proof of VA</p>
                          <div className="flex gap-2 flex-wrap">
                            {auditorImages.slice(0, 4).map((image, imgIndex) => (
                              <img key={imgIndex} src={buildImageUrl(image)} alt={`a-${imgIndex}`}
                                className="w-14 h-14 object-cover rounded-lg border cursor-pointer"
                                onClick={() => { setSelectedImages(auditorImages.map(img => buildImageUrl(img))); setCurrentImageIndex(imgIndex); setShowImageModal(true); }}
                              />
                            ))}
                            {auditorImages.length > 4 && (
                              <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                                onClick={() => { setSelectedImages(auditorImages.map(img => buildImageUrl(img))); setCurrentImageIndex(0); setShowImageModal(true); }}>
                                +{auditorImages.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {supervisorImages.length > 0 && (
                        <div>
                          <p className="text-gray-400 mb-1" style={{ fontSize: '11px' }}>Supervisor Proof</p>
                          <div className="flex gap-2 flex-wrap">
                            {supervisorImages.slice(0, 4).map((image, imgIndex) => (
                              <img key={imgIndex} src={buildImageUrl(image)} alt={`s-${imgIndex}`}
                                className="w-14 h-14 object-cover rounded-lg border cursor-pointer"
                                onClick={() => { setSelectedImages(supervisorImages.map(img => buildImageUrl(img))); setCurrentImageIndex(imgIndex); setShowImageModal(true); }}
                              />
                            ))}
                            {supervisorImages.length > 4 && (
                              <div className="w-14 h-14 bg-gray-100 border rounded-lg flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                                onClick={() => { setSelectedImages(supervisorImages.map(img => buildImageUrl(img))); setCurrentImageIndex(0); setShowImageModal(true); }}>
                                +{supervisorImages.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manager section */}
                  {managerReview && (
                    <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Manager Status</p>
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${managerReview.manager_status === 'Accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`} style={{ fontSize: '12px' }}>{managerReview.manager_status || '-'}</span>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-0.5" style={{ fontSize: '11px' }}>Manager Reason</p>
                        <p className="font-semibold text-gray-800" style={{ fontSize: '13px' }}>{managerReview.reason || '-'}</p>
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
            <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
              <XMarkIcon className="w-6 h-6" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = selectedImages[currentImageIndex]; link.download = `image-${currentImageIndex + 1}.jpg`; link.click(); }} className="absolute top-4 right-16 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
              <ArrowDownTrayIcon className="w-6 h-6" />
            </button>
            {selectedImages.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p > 0 ? p - 1 : selectedImages.length - 1); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(p => p < selectedImages.length - 1 ? p + 1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}
            <img src={selectedImages[currentImageIndex]} alt="Preview" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
            {selectedImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded">
                {currentImageIndex + 1} / {selectedImages.length}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">
                  {checklistData?.checklist_name || `Checklist ID: ${id}`}
                </h1>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-indigo-100 text-indigo-800">
                  {items.length > 0 ? items[0]?.type || 'Type' : 'Type'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                  {checklistData?.department_name || 'Department'}
                </span>
                <span className="text-gray-400">•</span>
                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                  {checklistData?.location_name || 'Location'}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {new Date(checklistData?.created_at).toLocaleDateString()}
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
                  NC High: {items.filter(item => item.criticality === 'High' && responses[item.id]?.status === 'No').length}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                  NC Low: {items.filter(item => item.criticality === 'Low' && responses[item.id]?.status === 'No').length}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  NC Total: {items.filter(item => responses[item.id]?.status === 'No').length}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-5 pt-5">
              {checklistData?.status && getStatusBadge(checklistData.status)}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg mb-6">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
            >
              <span className="font-medium text-gray-900">Supervisor Checklist Review</span>
              {showForm ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
            </button>
            {showForm && (
              <div className="p-4">
                {Object.keys(supervisorReviews).length === 0 ? (
                  items.length > 0 ? (
                    <div className="bg-white border border-green-100 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                        <span className="text-sm font-medium text-green-700">✓ Completed without NCs — All items passed</span>
                      </div>
                      <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                        <table className="min-w-full">
                          <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activities</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Reason</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Images</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => {
                              const response = responses[item.id] || {};
                              const auditorImages = response?.image_name?.split(',').filter(img => img) || [];
                              return (
                                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.activities || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.process || '-'}</td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">{response.status || '-'}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{response.reason || '-'}</td>
                                  <td className="px-4 py-3">
                                    {auditorImages.length > 0 ? (
                                      <div className="flex gap-1">
                                        {auditorImages.slice(0, 3).map((image, imgIndex) => (
                                          <img key={imgIndex} src={buildImageUrl(image)} alt={`img ${imgIndex + 1}`}
                                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                            onClick={() => { setSelectedImages(auditorImages.map(img => buildImageUrl(img))); setCurrentImageIndex(imgIndex); setShowImageModal(true); }}
                                          />
                                        ))}
                                        {auditorImages.length > 3 && <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600">+{auditorImages.length - 3}</div>}
                                      </div>
                                    ) : <span className="text-gray-400 text-sm">-</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No data found for this checklist.</div>
                  )
                ) : (
                  <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                    <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                      <table className="min-w-full">
                        <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activities</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor Reason</th>
                            {checklistData?.type === 'SC' && (
                              <>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Auditor Response</th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Executive Images</th>
                                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Executive Reason</th>
                              </>
                            )}
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Supervisor Action</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Images</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Reason Category</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Manager Reason</th>
                            <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Manager Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.values(supervisorReviews).map((supervisorReview, index) => {
                            const item = items.find(i => i.id === supervisorReview.checklist_item_id);
                            const response = responses[supervisorReview.checklist_item_id];
                            const auditorImages = response?.image_name?.split(',').filter(img => img) || [];
                            const supervisorImages = supervisorReview?.supervisor_images?.split(',').filter(img => img) || [];
                            const executiveResponse = executiveData[supervisorReview.checklist_item_id];
                            const executiveImages = executiveResponse?.image_name?.split(',').filter(img => img) || [];
                            const managerReview = managerReviews[supervisorReview.checklist_item_id];

                            return (
                              <tr key={supervisorReview.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '200px' }}>
                                  {item?.activities || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '150px' }}>
                                  {item?.process || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                  {response?.reason || '-'}
                                </td>
                                {checklistData?.type === 'SC' && (
                                  <>
                                    <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                      {response?.textbox || '-'}
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
                                                setSelectedImages(executiveImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(imgIndex);
                                                setShowImageModal(true);
                                              }}
                                            />
                                          ))}
                                          {executiveImages.length > 3 && (
                                            <div
                                              className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                              onClick={() => {
                                                setSelectedImages(executiveImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(3);
                                                setShowImageModal(true);
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
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={supervisorReview?.status || 'Open'}
                                      readOnly
                                      className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-gray-100"
                                    />
                                    <textarea
                                      value={supervisorReview?.reason || ''}
                                      readOnly
                                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 resize-none bg-gray-100"
                                      rows="3"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '300px' }}>
                                  <div className="space-y-3">
                                    <div>
                                      <div className="text-sm font-medium text-gray-700 mb-2">Proof of VA</div>
                                      {auditorImages.length > 0 ? (
                                        <div className="flex gap-1 items-center">
                                          {auditorImages.slice(0, 3).map((image, imgIndex) => (
                                            <img
                                              key={imgIndex}
                                              src={buildImageUrl(image)}
                                              alt={`Auditor ${imgIndex + 1}`}
                                              className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                              onClick={() => {
                                                setSelectedImages(auditorImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(imgIndex);
                                                setShowImageModal(true);
                                              }}
                                            />
                                          ))}
                                          {auditorImages.length > 3 && (
                                            <div
                                              className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                              onClick={() => {
                                                setSelectedImages(auditorImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(3);
                                                setShowImageModal(true);
                                              }}
                                            >
                                              +{auditorImages.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-gray-500 text-sm">No auditor images</div>
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-700 mb-2">Supervisor Upload:</div>
                                      {supervisorImages.length > 0 ? (
                                        <div className="flex gap-1 items-center">
                                          {supervisorImages.slice(0, 3).map((image, imgIndex) => (
                                            <img
                                              key={imgIndex}
                                              src={buildImageUrl(image)}
                                              alt={`Supervisor ${imgIndex + 1}`}
                                              className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                              onClick={() => {
                                                setSelectedImages(supervisorImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(imgIndex);
                                                setShowImageModal(true);
                                              }}
                                            />
                                          ))}
                                          {supervisorImages.length > 3 && (
                                            <div
                                              className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                              onClick={() => {
                                                setSelectedImages(supervisorImages.map(img => buildImageUrl(img)));
                                                setCurrentImageIndex(3);
                                                setShowImageModal(true);
                                              }}
                                            >
                                              +{supervisorImages.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="text-gray-500 text-sm">No supervisor images</div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '160px' }}>
                                  <input
                                    type="text"
                                    value={supervisorReview?.reason_category || ''}
                                    readOnly
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-gray-100"
                                  />
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                                  <input
                                    type="text"
                                    value={supervisorReview?.supervisor_status || ''}
                                    readOnly
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-gray-100"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                  {managerReview?.reason || '-'}
                                </td>
                                <td className="px-4 py-3" style={{ minWidth: '120px' }}>
                                  <input
                                    type="text"
                                    value={managerReview?.manager_status || '-'}
                                    readOnly
                                    className="text-sm border border-gray-300 rounded-md px-2 py-1 w-full bg-gray-100"
                                  />
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
        </div>
      </div>

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

export default SupervisorViewChecklist;