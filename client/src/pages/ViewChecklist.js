import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, DocumentArrowDownIcon, EnvelopeIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { checklistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getCriticalityBadgeClass, canViewAccordions, buildImageUrl, getStatusBadgeClass, formatTime } from '../utils/checklistUtils';
import { formatDate } from '../utils/dateFormatter';
import showToast from '../utils/toast';


const ViewChecklist = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('Process');
  const [checklistData, setChecklistData] = useState(null);
  const [items, setItems] = useState([]);
  const [responses, setResponses] = useState({});
  const [executiveData, setExecutiveData] = useState(null);
  const [supervisorReviews, setSupervisorReviews] = useState([]);
  const [managerReviews, setManagerReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdditionalFields, setShowAdditionalFields] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ to: '', cc: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

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
      const [checklistRes, itemsRes, responsesRes] = await Promise.all([
        checklistAPI.getChecklist(id),
        checklistAPI.getChecklistItems(id),
        checklistAPI.getChecklistResponses(id)
      ]);
      
      setChecklistData(checklistRes.data.checklist);
      
      // Sort items by id (checklist_item_id)
      const sortedItems = (itemsRes.data.items || []).sort((a, b) => a.id - b.id);
      setItems(sortedItems);
      
      const responsesMap = {};
      responsesRes.data.responses.forEach(r => {
        responsesMap[r.checklist_item_id] = r;
      });
      setResponses(responsesMap);
      
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
            const templateItems = executiveResult.items || [];
            const mapped = templateItems.map(tItem => execMap[tItem.id] || null);
            setExecutiveData(execMap);
          }
        } catch (error) {
          // No executive data
        }
      }

      // Fetch supervisor reviews
      try {
        const supervisorRes = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/checklists/${id}/all-supervisor-reviews`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (supervisorRes.ok) {
          const supervisorResult = await supervisorRes.json();
          setSupervisorReviews(supervisorResult.reviews || []);
        }
      } catch (error) {
        console.error('Error fetching supervisor reviews:', error);
      }

      // Fetch manager reviews
      try {
        const managerRes = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/checklists/${id}/manager-reviews`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (managerRes.ok) {
          const managerResult = await managerRes.json();
          setManagerReviews(managerResult.reviews || []);
        }
      } catch (error) {
        console.error('Error fetching manager reviews:', error);
      }
    } catch (error) {
      // Error fetching checklist
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

  const exportPDF = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/checklists/${id}/export-pdf`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(checklistData?.checklist_name || 'checklist').replace(/\s*-\s*\d{4}-\d{2}-\d{2}\s*-\s*User\d+$/i, '')}_NC_Report.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting PDF:', err);
    }
  };



  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                  {formatDate(new Date(checklistData?.created_at))}
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
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                  NC High: {items.filter(item => item.criticality === 'High' && responses[item.id]?.status === 'No').length}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                  NC Low: {items.filter(item => item.criticality === 'Low' && responses[item.id]?.status === 'No').length}
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  NC Total: {items.filter(item => responses[item.id]?.status === 'No').length}
                </span>
                {checklistData?.category_id === 2 && (
                  <>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Score Yes: {items.filter(i => responses[i.id]?.status === 'Yes').length * 10}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      Score No: {items.filter(i => responses[i.id]?.status === 'No').length * 10}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className=" gap-4 mt-5 pt-5">
              <div >
                  {checklistData?.status && getStatusBadge(checklistData.status)}
              </div>
              {(checklistData?.category_id === 2 || checklistData?.category_id === 6) &&(
                <div className='flex items-center gap-4 mt-5 pt-5'>
                  <button
                    onClick={exportPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <DocumentArrowDownIcon className="w-5 h-5" />
                    Export
                  </button>
                  <button
                    onClick={() => { setEmailData({ to: '', cc: '' }); setShowEmailModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <EnvelopeIcon className="w-5 h-5" />
                    Email
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Checklist Form - Hide accordion for Supervisor and Manager only */}
          {canViewAccordions(user?.role) && (
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
                      <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                        <table className="min-w-full">
                          <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>Activities</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>Process</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Status</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Reason</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>Images</th>
                              {checklistData?.type === 'SC' && executiveData && Object.keys(executiveData).length > 0 && (
                                <>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Auditor Response</th>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>Executive Images</th>
                                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Executive Reason</th>
                                </>
                              )}
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '200px' }}>Supervisor Images</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Supervisor Reason</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '120px' }}>Supervisor Status</th>
                              <th className="px-4 py-4 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Manager Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {items.map((item, index) => {
                              const response = responses[item.id];
                              const images = response?.image_name?.split(',').filter(img => img) || [];
                              const executiveResponse = executiveData?.[item.id];
                              const executiveImages = executiveResponse?.image_name?.split(',').filter(img => img) || [];
                              const supervisorReview = supervisorReviews.find(rev => rev.checklist_item_id === item.id);
                              const supervisorImages = supervisorReview?.supervisor_images?.split(',').filter(img => img) || [];
                              const managerReview = managerReviews.find(rev => rev.checklist_item_id === item.id);

                              return (
                                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '200px' }}>
                                    <div className="flex items-center gap-2">
                                      <span>{item.activities || item.type}</span>
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                                        {item.criticality || 'N/A'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '120px' }}>
                                    {item.process || 'Other'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '100px' }}>
                                    {response?.status || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                    {response?.reason || '-'}
                                  </td>
                                  <td className="px-4 py-3" style={{ minWidth: '200px' }}>
                                    <div className="flex space-x-2">
                                      {images.length > 0 ? (
                                        <div
                                          className="flex space-x-2 cursor-pointer"
                                          onClick={() => {
                                            setSelectedImages(images.map(img => buildImageUrl(img)));
                                            setCurrentImageIndex(0);
                                            setShowImageModal(true);
                                          }}
                                        >
                                          {images.slice(0, 3).map((img, i) => (
                                            <div key={i} className="w-12 h-12 border border-gray-300 rounded overflow-hidden hover:opacity-75 transition-opacity">
                                              <img
                                                src={buildImageUrl(img)}
                                                alt={`Proof ${i + 1}`}
                                                className="w-full h-full object-cover"
                                              />
                                            </div>
                                          ))}
                                          {images.length > 3 && (
                                            <div className="w-12 h-12 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                              +{images.length - 3}
                                            </div>
                                          )}
                                        </div>
                                      ) : ('-'
                                      )}
                                    </div>
                                  </td>
                                  {checklistData?.type === 'SC' && executiveData && Object.keys(executiveData).length > 0 && (
                                    <>
                                      <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                        {response?.textbox || '-'}
                                      </td>
                                      <td className="px-4 py-3" style={{ minWidth: '200px' }}>
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
                                          <span className="text-gray-400 text-sm">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                        {executiveResponse?.reason || <span className="text-gray-400 text-sm">-</span>}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-4 py-3" style={{ minWidth: '200px' }}>
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
                                      <span className="text-gray-400 text-sm">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                    {supervisorReview?.reason || <span className="text-gray-400 text-sm">-</span>}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '120px' }}>
                                    {supervisorReview?.supervisor_status || <span className="text-gray-400 text-sm">-</span>}
                                  </td>
                                  {/* <td className="px-4 py-3" style={{minWidth: '200px'}}>
                                  {managerImages.length > 0 ? (
                                    <div className="flex gap-1 items-center">
                                      {managerImages.slice(0, 3).map((image, imgIndex) => (
                                        <img
                                          key={imgIndex}
                                          src={buildImageUrl(image)}
                                          alt={`Manager ${imgIndex + 1}`}
                                          className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 flex-shrink-0"
                                          onClick={() => {
                                            setSelectedImages(managerImages.map(img => buildImageUrl(img)));
                                            setCurrentImageIndex(imgIndex);
                                            setShowImageModal(true);
                                          }}
                                        />
                                      ))}
                                      {managerImages.length > 3 && (
                                        <div 
                                          className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200 flex-shrink-0"
                                          onClick={() => {
                                            setSelectedImages(managerImages.map(img => buildImageUrl(img)));
                                            setCurrentImageIndex(3);
                                            setShowImageModal(true);
                                          }}
                                        >
                                          +{managerImages.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-sm">-</span>
                                  )}
                                </td> */}
                                  <td className="px-4 py-3 text-sm text-gray-900" style={{ minWidth: '180px' }}>
                                    {managerReview?.manager_status || <span className="text-gray-400 text-sm">-</span>}
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
          )}

          {/* Additional Fields Accordion - Hide for Supervisor and Manager only, and hide for SC checklists */}
          {canViewAccordions(user?.role) && checklistData?.type !== 'SC' && (
            <div className="border border-gray-200 rounded-lg mb-6">
              <button
                onClick={() => setShowAdditionalFields(!showAdditionalFields)}
                className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 border-b border-gray-200 flex justify-between items-center"
              >
                <span className="font-medium text-gray-900">Checklist Details</span>
                {showAdditionalFields ? <ChevronUpIcon className="w-5 h-5 text-gray-500" /> : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
              </button>
              {showAdditionalFields && (
                <div className="p-6 bg-gray-50">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      <input type="text" value={checklistData?.location_name || ''} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                      <input type="text" value={checklistData?.department_name || ''} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Count</label>
                      <input type="text" value={checklistData?.camera_count || ''} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Audited</label>
                      <input type="text" value={checklistData?.total_camera_audited || '0'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Random Audited</label>
                      <input type="text" value={checklistData?.total_camera_random_audited || '0'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Not Audited</label>
                      <input type="text" value={checklistData?.total_camera_not_audited || '0'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Offline</label>
                      <input type="text" value={checklistData?.total_camera_offline || '0'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Offline (%)</label>
                      <input type="text" value={checklistData?.total_camera_offline_percent ? `${checklistData.total_camera_offline_percent}%` : '0%'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Technical Issues</label>
                      <input type="text" value={checklistData?.total_camera_technical_issues || '0'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Camera Technical Issues (%)</label>
                      <input type="text" value={checklistData?.total_camera_technical_issues_percent ? `${checklistData.total_camera_technical_issues_percent}%` : '0%'} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total No. NCs for the Day</label>
                      <input type="text" value={checklistData?.total_ncs || ''} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Camera File Upload</label>
                      {checklistData?.camera_file ? (
                        <div className="space-y-2">
                          {checklistData.camera_file.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                            <img
                              src={`${process.env.REACT_APP_BACKEND_URL}/uploads/camera-files/${checklistData.camera_file}`}
                              alt="Camera file preview"
                              className="w-20 h-16 object-cover rounded border cursor-pointer hover:opacity-80"
                              onClick={() => {
                                setSelectedImages([`${process.env.REACT_APP_BACKEND_URL}/uploads/camera-files/${checklistData.camera_file}`]);
                                setCurrentImageIndex(0);
                                setShowImageModal(true);
                              }}
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-gray-500 text-xs">📄</span>
                              </div>
                              <a
                                href={`${process.env.REACT_APP_BACKEND_URL}/uploads/camera-files/${checklistData.camera_file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline text-xs"
                              >
                                {checklistData.camera_file.split('-').slice(1).join('-')}
                              </a>
                            </div>
                          )}
                          <input type="text" value={checklistData.camera_file} readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                        </div>
                      ) : (
                        <input type="text" value="No file chosen" readOnly className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                      )}
                    </div>
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Remark</label>
                      <textarea value={checklistData?.remark || ''} readOnly rows="3" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 bg-gray-100" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Send Email</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                <input
                  type="text"
                  value={emailData.to}
                  onChange={(e) => setEmailData(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="user1@example.com, user2@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CC</label>
                <input
                  type="text"
                  value={emailData.cc}
                  onChange={(e) => setEmailData(prev => ({ ...prev, cc: e.target.value }))}
                  placeholder="cc1@example.com, cc2@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Separate multiple emails with commas</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSendingEmail(true);
                  try {
                    const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/checklists/${id}/send-email`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                      body: JSON.stringify({ to: emailData.to, cc: emailData.cc })
                    });
                    if (res.ok) {
                      showToast('success', 'Email queued successfully');
                      setShowEmailModal(false);
                    } else {
                      const data = await res.json();
                      showToast('error', data.error || 'Failed to send email');
                    }
                  } catch (err) {
                    showToast('error', 'Failed to send email');
                  } finally {
                    setSendingEmail(false);
                  }
                }}
                disabled={!emailData.to || sendingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? 'Sending...' : 'Send Mail'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              download={`image-${currentImageIndex + 1}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
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

export default ViewChecklist;