import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { rosterAPI, qcAPI } from '../services/api';
import { buildImageUrl, downloadImage } from '../utils/checklistUtils';
import SearchableSelect from '../components/SearchableSelect';

const LeadAuditorForm = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    empId: '',
    name: '',
    videoDate: '',
    checklistName: '',
    checklistId: '',
    location: '',
    cameraAudited: '',
    ncResponse: '',
    ncQCCount: ''
  });
  const [completedChecklists, setCompletedChecklists] = useState([]);
  const [checklistViewData, setChecklistViewData] = useState(null);
  const [qcData, setQcData] = useState({});
  const [selectedActivity, setSelectedActivity] = useState([]);
  const [selectedProcess, setSelectedProcess] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newItems, setNewItems] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  const blobUrlCache = useRef(new Map());

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

  const getBlobUrl = (file) => {
    if (!(file instanceof File)) return null;
    if (!blobUrlCache.current.has(file)) {
      blobUrlCache.current.set(file, URL.createObjectURL(file));
    }
    return blobUrlCache.current.get(file);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = async (date) => {
    setFormData(prev => ({ ...prev, videoDate: date, checklistName: '', checklistId: '', empId: '', name: '', location: '', cameraAudited: '' }));
    setCompletedChecklists([]);
    setChecklistViewData(null);
    setQcData({});
    setSelectedActivity([]);
    setSelectedProcess([]);
    setSelectedStatus([]);
    setNewItems([]);

    if (!date) return;

    try {
      setLoadingChecklists(true);
      const response = await rosterAPI.getCompletedChecklistsByDate(date);
      setCompletedChecklists(response.data.checklists || []);
    } catch (error) {
      toast.error('Failed to fetch checklists for selected date');
    } finally {
      setLoadingChecklists(false);
    }
  };

  const handleChecklistSelect = async (checklistId) => {
    const selected = completedChecklists.find(c => String(c.checklist_id) === String(checklistId));
    if (selected) {
      setFormData(prev => ({
        ...prev,
        checklistId: selected.checklist_id,
        checklistName: selected.checklist_name,
        empId: selected.emp_id || '',
        name: selected.auditor_name || '',
        location: selected.location_name || '',
        cameraAudited: selected.camera_audited || ''
      }));
      try {
        setLoadingView(true);
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/reports/checklist/${selected.checklist_id}/view`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChecklistViewData(response.data.data);
        setQcData({});
        setSelectedActivity([]);
        setSelectedProcess([]);
        setSelectedStatus([]);
        setNewItems([]);
      } catch (error) {
        toast.error('Failed to fetch checklist data');
        setChecklistViewData(null);
      } finally {
        setLoadingView(false);
      }
    } else {
      setFormData(prev => ({ ...prev, checklistId: '', checklistName: '', empId: '', name: '', location: '', cameraAudited: '' }));
      setChecklistViewData(null);
      setQcData({});
      setSelectedActivity([]);
      setSelectedProcess([]);
      setSelectedStatus([]);
      setNewItems([]);
    }
  };

  const addNewItem = () => {
    setNewItems(prev => [...prev, {
      id: `new_${Date.now()}`,
      activities: '',
      process: '',
      criticality: 'High',
      status: '',
      reason: '',
      images: [],
      qcUpdate: '',
      remark: '',
      qcImages: []
    }]);
  };

  const removeNewItem = (itemId) => {
    setNewItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleNewItemChange = (itemId, field, value) => {
    setNewItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } : item));
  };

  const handleNewItemFile = (itemId, files) => {
    const newFiles = Array.from(files);
    setNewItems(prev => prev.map(item => item.id === itemId ? { ...item, images: [...item.images, ...newFiles] } : item));
  };
  

  const removeNewItemImage = (itemId, imgIndex) => {
    setNewItems(prev => prev.map(item => item.id === itemId ? { ...item, images: item.images.filter((_, i) => i !== imgIndex) } : item));
  };

  const handleNewItemQcFile = (itemId, files) => {
    const newFiles = Array.from(files);
    setNewItems(prev => prev.map(item => item.id === itemId ? { ...item, qcImages: [...item.qcImages, ...newFiles] } : item));
  };

  const removeNewItemQcImage = (itemId, imgIndex) => {
    setNewItems(prev => prev.map(item => item.id === itemId ? { ...item, qcImages: item.qcImages.filter((_, i) => i !== imgIndex) } : item));
  };

  const handleQcChange = (itemKey, field, value) => {
    setQcData(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], [field]: value }
    }));
  };

  const handleQcFile = (itemKey, files) => {
    const newFiles = Array.from(files);
    setQcData(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], images: [...(prev[itemKey]?.images || []), ...newFiles] }
    }));
  };

  const removeQcImage = (itemKey, imgIndex) => {
    setQcData(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], images: (prev[itemKey]?.images || []).filter((_, i) => i !== imgIndex) }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.checklistId || !formData.videoDate) {
      toast.error('Please select a date and checklist');
      return;
    }

    setSubmitting(true);
    try {
      const data = new FormData();

      // Build qcData with item IDs for backend
      const qcPayload = {};
      if (checklistViewData) {
        checklistViewData.submissions.forEach((submission) => {
          submission.items.forEach((item, idx) => {
            const itemKey = `${submission.data_id}-${idx}`;
            const rowQc = qcData[itemKey] || {};
            if (rowQc.qcUpdate || rowQc.remark || (rowQc.images && rowQc.images.length > 0)) {
              qcPayload[itemKey] = {
                itemKey,
                checklist_item_id: item.item_id || null,
                checklist_data_id: submission.data_id || null,
                qcUpdate: rowQc.qcUpdate || '',
                remark: rowQc.remark || ''
              };

              // Append images
              if (rowQc.images && rowQc.images.length > 0) {
                rowQc.images.forEach((file, imgIdx) => {
                  data.append('images', file, `${itemKey}_${imgIdx}_${file.name}`);
                });
              }
            }
          });
        });
      }

      // Add new items to qcPayload
      newItems.forEach((item, idx) => {
        const itemKey = `new_${idx}`;
        if (item.activities || item.qcUpdate || item.remark || item.qcImages.length > 0) {
          qcPayload[itemKey] = {
            itemKey,
            checklist_item_id: null,
            checklist_data_id: null,
            is_new_item: true,
            activities: item.activities || '',
            process: item.process || '',
            criticality: item.criticality || '',
            status: item.status || '',
            reason: item.reason || '',
            item_images: null,
            qcUpdate: item.qcUpdate || '',
            remark: item.remark || ''
          };

          // Append Images column files
          if (item.images && item.images.length > 0) {
            item.images.forEach((file, imgIdx) => {
              data.append('images', file, `${itemKey}-img_${imgIdx}_${file.name}`);
            });
          }

          if (item.qcImages && item.qcImages.length > 0) {
            item.qcImages.forEach((file, imgIdx) => {
              data.append('images', file, `${itemKey}_${imgIdx}_${file.name}`);
            });
          }
        }
      });

      const ncCount = allItems.filter(i => i.status === 'No').length;
      const ncQCCount = Object.values(qcPayload).length;

      data.append('data', JSON.stringify({
        formData: {
          ...formData,
          ncCount,
          ncQCCount
        },
        qcData: qcPayload
      }));

      await qcAPI.submit(data);
      toast.success('QC Form submitted successfully');
      // Reset form
      setFormData({ empId: '', name: '', videoDate: '', checklistName: '', checklistId: '', location: '', cameraAudited: '', ncResponse: '', ncQCCount: '' });
      setChecklistViewData(null);
      setQcData({});
      setCompletedChecklists([]);
      setNewItems([]);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const getCriticalityBadgeClass = (criticality) => {
    const classes = { 'High': 'bg-red-100 text-red-800', 'Low': 'bg-green-100 text-green-800', 'New': 'bg-blue-100 text-blue-800' };
    return classes[criticality] || 'bg-gray-100 text-gray-800';
  };

  const allItems = checklistViewData?.submissions?.flatMap(s => s.items || []) || [];

  // Get unique processes, activities, and statuses for dropdowns
  const uniqueProcesses = [...new Set(allItems.map(i => i.process).filter(Boolean))];
  const uniqueStatuses = [...new Set(allItems.map(i => i.status).filter(Boolean))];
  const filteredActivities = selectedProcess.length > 0
    ? [...new Set(allItems.filter(i => selectedProcess.includes(i.process)).map(i => i.activities).filter(Boolean))]
    : [...new Set(allItems.map(i => i.activities).filter(Boolean))];

  // Filter table items based on selected process/activity
  const getFilteredItems = (items) => {
    return items.filter(item => {
      if (selectedProcess.length > 0 && !selectedProcess.includes(item.process)) return false;
      if (selectedActivity.length > 0 && !selectedActivity.includes(item.activities)) return false;
      if (selectedStatus.length > 0 && !selectedStatus.includes(item.status)) return false;
      return true;
    }).sort((a, b) => {
      if (a.status === 'No' && b.status !== 'No') return -1;
      if (a.status !== 'No' && b.status === 'No') return 1;
      return 0;
    });
  };

  const showTable = !!checklistViewData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Virtual Audit QC</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1: Basic Details */}
        <div className="bg-white border border-red-100 rounded-lg">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">Basic Details</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video Date</label>
                <input type="date" value={formData.videoDate} onChange={e => handleDateChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name</label>
                <SearchableSelect
                  options={completedChecklists.map(c => ({ id: c.checklist_id, name: c.checklist_name }))}
                  value={formData.checklistId}
                  onChange={(val) => handleChecklistSelect(val)}
                  placeholder={loadingChecklists ? 'Loading...' : completedChecklists.length === 0 && formData.videoDate ? 'No completed checklists' : 'Select Checklist'}
                  displayKey="name"
                  valueKey="id"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emp ID</label>
                <input type="text" value={formData.empId} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={formData.name} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={formData.location} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
              </div>
            </div>
            {checklistViewData && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Process</label>
                  <SearchableSelect
                    options={uniqueProcesses.map(p => ({ id: p, name: p }))}
                    value={selectedProcess}
                    onChange={(val) => { setSelectedProcess(val); setSelectedActivity([]); }}
                    placeholder="Select Process"
                    displayKey="name"
                    valueKey="id"
                    multiSelect={true}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Activities</label>
                  <SearchableSelect
                    options={filteredActivities.map(a => ({ id: a, name: a }))}
                    value={selectedActivity}
                    onChange={(val) => setSelectedActivity(val)}
                    placeholder="Select Activity"
                    displayKey="name"
                    valueKey="id"
                    multiSelect={true}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <SearchableSelect
                    options={uniqueStatuses.map(s => ({ id: s, name: s }))}
                    value={selectedStatus}
                    onChange={(val) => setSelectedStatus(val)}
                    placeholder="Select Status"
                    displayKey="name"
                    valueKey="id"
                    multiSelect={true}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Checklist Data Table */}
        {checklistViewData && showTable && (
          <div className="bg-white border border-red-100 rounded-lg">
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <h2 className="text-sm font-medium text-gray-700">Checklist Data</h2>
            </div>
            <div className="overflow-auto" style={{ maxHeight: '500px' }}>
              {loadingView ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <table className="min-w-full" style={{ minWidth: '1100px' }}>
                  <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Activities</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Process</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '90px' }}>Criticality</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '70px' }}>Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '140px' }}>Reason</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Images</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '140px' }}>QC Updates</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '160px' }}>QC Remark</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Related Image/File</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {checklistViewData.submissions.map((submission) =>
                      getFilteredItems(submission.items).map((item, idx) => {
                        const itemKey = `${submission.data_id}-${submission.items.indexOf(item)}`;
                        const rowQc = qcData[itemKey] || {};
                        return (
                          <tr key={itemKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.activities}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.process}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                                {item.criticality || 'N/A'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.status || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.reason || '-'}</td>
                            <td className="px-4 py-3">
                              {item.images && item.images.length > 0 ? (
                                <div className="flex gap-1 cursor-pointer">
                                  {item.images.slice(0, 3).map((img, i) => (
                                    <div
                                      key={i}
                                      className="w-12 h-12 border border-gray-300 rounded overflow-hidden hover:opacity-75"
                                      onClick={() => {
                                        setSelectedImages(item.images.map(im => buildImageUrl(im)));
                                        setCurrentImageIndex(i);
                                        setShowImageModal(true);
                                      }}
                                    >
                                      <img src={buildImageUrl(img)} alt={`Proof ${i + 1}`} className="w-full h-full object-cover" />
                                    </div>
                                  ))}
                                  {item.images.length > 3 && (
                                    <div
                                      className="w-12 h-12 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200"
                                      onClick={() => {
                                        setSelectedImages(item.images.map(im => buildImageUrl(im)));
                                        setCurrentImageIndex(3);
                                        setShowImageModal(true);
                                      }}
                                    >
                                      +{item.images.length - 3}
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={rowQc.qcUpdate || ''}
                                onChange={e => handleQcChange(itemKey, 'qcUpdate', e.target.value)}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              >
                                <option value="">Select</option>
                                <option value="Missed">Missed</option>
                                <option value="Wrong">Wrong</option>
                                <option value="Invalid">Invalid</option>
                                <option value="Others">Others</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={rowQc.remark || ''}
                                onChange={e => handleQcChange(itemKey, 'remark', e.target.value)}
                                placeholder="Enter remark"
                                className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-2">
                                {rowQc.images && rowQc.images.length > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">{rowQc.images.length} image(s)</span>
                                    <button
                                      type="button"
                                      onClick={() => setQcData(prev => ({ ...prev, [itemKey]: { ...prev[itemKey], images: [] } }))}
                                      className="text-xs text-red-500 hover:text-red-700"
                                    >Delete All</button>
                                  </div>
                                )}
                                <div
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => { e.preventDefault(); handleQcFile(itemKey, e.dataTransfer.files); }}
                                  onClick={() => document.getElementById(`qc-file-${itemKey}`).click()}
                                  className="border-2 border-dashed rounded-lg p-2 cursor-pointer hover:bg-gray-50 min-h-[80px] max-h-[120px] overflow-y-auto border-gray-300"
                                >
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    id={`qc-file-${itemKey}`}
                                    onChange={e => { handleQcFile(itemKey, e.target.files); e.target.value = ''; }}
                                    className="hidden"
                                  />
                                  {rowQc.images && rowQc.images.length > 0 ? (
                                    <div className="flex gap-1 flex-wrap">
                                      {rowQc.images.slice(0, 3).map((img, imgIdx) => (
                                        <div key={imgIdx} className="relative group">
                                          <img
                                            src={getBlobUrl(img)}
                                            alt={`Upload ${imgIdx + 1}`}
                                            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedImages(rowQc.images.map(f => getBlobUrl(f)));
                                              setCurrentImageIndex(imgIdx);
                                              setShowImageModal(true);
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); removeQcImage(itemKey, imgIdx); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center opacity-80 group-hover:opacity-100"
                                          >×</button>
                                        </div>
                                      ))}
                                      {rowQc.images.length > 3 && (
                                        <div
                                          className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedImages(rowQc.images.map(f => getBlobUrl(f)));
                                            setCurrentImageIndex(3);
                                            setShowImageModal(true);
                                          }}
                                        >+{rowQc.images.length - 3}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      <div className="text-sm text-gray-600 text-center">
                                        <p>Drag images or click</p>
                                        <p className="text-xs text-gray-400 mt-1">Multiple files supported</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {/* New Items added by Lead Auditor */}
                    {newItems.map((newItem) => (
                      <tr key={newItem.id} className="bg-white">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <input type="text" value={newItem.activities} onChange={e => handleNewItemChange(newItem.id, 'activities', e.target.value)} placeholder="Activities" className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                            <button type="button" onClick={() => removeNewItem(newItem.id)} className="text-red-500 hover:text-red-700 text-xl font-bold w-6 h-6 flex items-center justify-center flex-shrink-0">×</button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={newItem.process} onChange={e => handleNewItemChange(newItem.id, 'process', e.target.value)} placeholder="Process" className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass('High')}`}>High</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">-</td>
                        <td className="px-4 py-3 text-sm text-gray-400">-</td>
                        <td className="px-4 py-3 text-sm text-gray-400">-</td>
                        <td className="px-4 py-3">
                          <select value={newItem.qcUpdate} onChange={e => handleNewItemChange(newItem.id, 'qcUpdate', e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                            <option value="">Select</option>
                            <option value="Missed">Missed</option>
                            <option value="Wrong">Wrong</option>
                            <option value="Invalid">Invalid</option>
                            <option value="Others">Others</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={newItem.remark} onChange={e => handleNewItemChange(newItem.id, 'remark', e.target.value)} placeholder="Remark" className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); handleNewItemQcFile(newItem.id, e.dataTransfer.files); }}
                            onClick={() => document.getElementById(`new-qc-img-${newItem.id}`).click()}
                            className="border-2 border-dashed rounded-lg p-2 cursor-pointer hover:bg-gray-50 min-h-[80px] max-h-[120px] overflow-y-auto border-gray-300"
                          >
                            <input type="file" multiple accept="image/*" id={`new-qc-img-${newItem.id}`} onChange={e => { handleNewItemQcFile(newItem.id, e.target.files); e.target.value = ''; }} className="hidden" />
                            {newItem.qcImages.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {newItem.qcImages.slice(0, 3).map((img, i) => (
                                  <div key={i} className="relative group">
                                    <img src={getBlobUrl(img)} alt="" className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80" onClick={e => { e.stopPropagation(); setSelectedImages(newItem.qcImages.map(f => getBlobUrl(f))); setCurrentImageIndex(i); setShowImageModal(true); }} />
                                    <button type="button" onClick={e => { e.stopPropagation(); removeNewItemQcImage(newItem.id, i); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs hover:bg-red-600 flex items-center justify-center opacity-80 group-hover:opacity-100">×</button>
                                  </div>
                                ))}
                                {newItem.qcImages.length > 3 && (
                                  <div className="w-12 h-12 bg-gray-100 border rounded flex items-center justify-center text-xs text-gray-600 cursor-pointer hover:bg-gray-200" onClick={e => { e.stopPropagation(); setSelectedImages(newItem.qcImages.map(f => getBlobUrl(f))); setCurrentImageIndex(3); setShowImageModal(true); }}>+{newItem.qcImages.length - 3}</div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-sm text-gray-600 text-center">
                                  <p>Drag images or click</p>
                                  <p className="text-xs text-gray-400 mt-1">Multiple files supported</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Add New Item Button */}
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <button type="button" onClick={addNewItem} className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition-colors">
                  + Add New Item
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: NC Details */}
        <div className="bg-white border border-red-100 rounded-lg">
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-medium text-gray-700">NC Details</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No of Camera Audited</label>
                <input type="number" min="0" value={formData.cameraAudited} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">No of NC in Portal</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">1. Response</label>
                    <input type="text" value={checklistViewData ? allItems.filter(i => i.status === 'No').length : formData.ncResponse} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">2. No Of QC</label>
                    <input type="text" value={Object.values(qcData).filter(q => q.qcUpdate && q.qcUpdate !== '').length + newItems.filter(i => i.qcUpdate && i.qcUpdate !== '').length} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50" style={{ background: '#C50B34' }}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>

      {/* Image Gallery Modal */}
      {showImageModal && selectedImages.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setShowImageModal(false)}>
          <div className="relative w-full h-full flex items-center justify-center">
            <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10">
              <XMarkIcon className="w-6 h-6" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); downloadImage(selectedImages[currentImageIndex]); }} className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10">
              <ArrowDownTrayIcon className="w-6 h-6" />
            </button>
            {selectedImages.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1); }} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0); }} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10">
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}
            <img src={selectedImages[currentImageIndex]} alt={`Preview ${currentImageIndex + 1}`} className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
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

export default LeadAuditorForm;
