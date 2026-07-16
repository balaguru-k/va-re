import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { qcAPI } from '../services/api';
import { buildImageUrl, downloadImage } from '../utils/checklistUtils';

const LeadAuditorFormDataView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await qcAPI.getSubmissionDetail(id);
        setSubmission(response.data.submission);
        setItems(response.data.items || []);
      } catch (error) {
        toast.error('Failed to fetch submission detail');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showImageModal) return;
      if (e.key === 'Escape') setShowImageModal(false);
      else if (e.key === 'ArrowLeft' && selectedImages.length > 1) setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedImages.length - 1);
      else if (e.key === 'ArrowRight' && selectedImages.length > 1) setCurrentImageIndex(prev => prev < selectedImages.length - 1 ? prev + 1 : 0);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showImageModal, selectedImages.length]);

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCriticalityBadgeClass = (c) => ({ 'High': 'bg-red-100 text-red-800', 'Low': 'bg-green-100 text-green-800', 'New': 'bg-blue-100 text-blue-800' }[c] || 'bg-gray-100 text-gray-800');

  const buildQcImageUrl = (filename) => `${process.env.REACT_APP_API_URL?.replace('/api', '')}/uploads/qc-images/${filename}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!submission) {
    return <div className="text-center py-12 text-gray-500">Submission not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/lead-auditor/form-data')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">QC Submission Detail</h1>
      </div>

      {/* Submission Info */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Submission Info</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div>
              <p className="text-xs text-gray-500">Video Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(submission.video_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Checklist Name</p>
              <p className="text-sm font-medium text-gray-900">{submission.checklist_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Emp ID</p>
              <p className="text-sm font-medium text-gray-900">{submission.emp_id || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Auditor</p>
              <p className="text-sm font-medium text-gray-900">{submission.auditor_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm font-medium text-gray-900">{submission.location || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">NC Count</p>
              <p className="text-sm font-medium text-gray-900">{submission.nc_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Submitted By</p>
              <p className="text-sm font-medium text-gray-900">{submission.submitted_by_name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">QC Items ({items.length})</h2>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '500px' }}>
          <table className="min-w-full" style={{ minWidth: '1200px' }}>
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Activities</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Process</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Criticality</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Reason</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor Images</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">QC Update</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Remark</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">QC Images</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Auditor QC Remark</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">QC Final Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const qcImages = item.images ? JSON.parse(item.images) : [];
                const auditorImages = item.item_images ? (item.item_images.startsWith('[') ? JSON.parse(item.item_images) : item.item_images.split(',').filter(i => i.trim())) : [];
                const auditorImageUrlBuilder = item.is_new_item ? buildQcImageUrl : buildImageUrl;

                return (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.activities || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.process || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCriticalityBadgeClass(item.criticality)}`}>
                        {item.criticality || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.item_status || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.item_reason || '-'}</td>
                    <td className="px-4 py-3">
                      {auditorImages.length > 0 ? (
                        <div className="flex gap-1 cursor-pointer">
                          {auditorImages.slice(0, 3).map((img, i) => (
                            <div key={i} className="w-10 h-10 border border-gray-300 rounded overflow-hidden hover:opacity-75"
                              onClick={() => { setSelectedImages(auditorImages.map(im => auditorImageUrlBuilder(im))); setCurrentImageIndex(i); setShowImageModal(true); }}>
                              <img src={auditorImageUrlBuilder(img)} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {auditorImages.length > 3 && (
                            <div className="w-10 h-10 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                              onClick={() => { setSelectedImages(auditorImages.map(im => auditorImageUrlBuilder(im))); setCurrentImageIndex(3); setShowImageModal(true); }}>
                              +{auditorImages.length - 3}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {item.qc_update ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">{item.qc_update}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.remark || '-'}</td>
                    <td className="px-4 py-3">
                      {qcImages.length > 0 ? (
                        <div className="flex gap-1 cursor-pointer">
                          {qcImages.slice(0, 3).map((img, i) => (
                            <div key={i} className="w-10 h-10 border border-gray-300 rounded overflow-hidden hover:opacity-75"
                              onClick={() => { setSelectedImages(qcImages.map(im => buildQcImageUrl(im))); setCurrentImageIndex(i); setShowImageModal(true); }}>
                              <img src={buildQcImageUrl(img)} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {qcImages.length > 3 && (
                            <div className="w-10 h-10 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                              onClick={() => { setSelectedImages(qcImages.map(im => buildQcImageUrl(im))); setCurrentImageIndex(3); setShowImageModal(true); }}>
                              +{qcImages.length - 3}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.auditor_qc_remark || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.qc_final_remark || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Modal */}
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

export default LeadAuditorFormDataView;
