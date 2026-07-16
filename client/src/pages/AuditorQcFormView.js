import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { qcAPI } from '../services/api';
import { buildImageUrl, downloadImage } from '../utils/checklistUtils';

const AuditorQcFormView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [items, setItems] = useState([]);
  const [remarks, setRemarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await qcAPI.getSubmissionDetail(id);
        setSubmission(response.data.submission);
        setItems(response.data.items || []);
        // Pre-fill existing remarks
        const existingRemarks = {};
        (response.data.items || []).forEach(item => {
          if (item.auditor_qc_remark) existingRemarks[item.qc_submission_item_id] = item.auditor_qc_remark;
        });
        setRemarks(existingRemarks);
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

  const handleSubmit = async () => {
    if (Object.keys(remarks).length === 0) {
      toast.error('Please add at least one remark');
      return;
    }
    try {
      setSubmitting(true);
      await qcAPI.submitAuditorRemark(id, remarks);
      toast.success('Remarks submitted successfully');
      navigate('/auditor/qc-form');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit remarks');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCriticalityBadgeClass = (c) => ({ 'High': 'bg-red-100 text-red-800', 'Low': 'bg-green-100 text-green-800', 'New': 'bg-blue-100 text-blue-800' }[c] || 'bg-gray-100 text-gray-800');

  const buildQcImageUrl = (filename) => `${process.env.REACT_APP_BACKEND_URL}/uploads/qc-images/${filename}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const allRemarksSubmitted = items.length > 0 && items.every(item => item.auditor_qc_remark && item.auditor_qc_remark.trim() !== '');

  if (!submission) return <div className="text-center py-12 text-gray-500">Submission not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/auditor/qc-form')} className="text-gray-600 hover:text-gray-900">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">QC Form - Add Remark</h1>
        </div>
      </div>

      {/* Submission Info */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Submission Info</h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500">Video Date</p>
              <p className="text-sm font-medium">{formatDate(submission.video_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Checklist</p>
              <p className="text-sm font-medium">{submission.checklist_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm font-medium">{submission.location || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">NC Count</p>
              <p className="text-sm font-medium">{submission.nc_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Submitted By</p>
              <p className="text-sm font-medium">{submission.submitted_by_name}</p>
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
          <table className="min-w-full" style={{ minWidth: '1300px' }}>
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Activities</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Process</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '80px' }}>Criticality</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '60px' }}>Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '130px' }}>Reason</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>Images</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>QC Update</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '150px' }}>QC Remark</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '100px' }}>QC Images</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>Auditor QC Remark</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700" style={{ minWidth: '180px' }}>QC Final Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => {
                const qcImages = item.images ? JSON.parse(item.images) : [];
                const auditorImages = item.item_images ? (item.item_images.startsWith('[') ? JSON.parse(item.item_images) : item.item_images.split(',').filter(i => i.trim())) : [];

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
                          {auditorImages.slice(0, 2).map((img, i) => (
                            <div key={i} className="w-10 h-10 border border-gray-300 rounded overflow-hidden hover:opacity-75"
                              onClick={() => { setSelectedImages(auditorImages.map(im => buildImageUrl(im))); setCurrentImageIndex(i); setShowImageModal(true); }}>
                              <img src={buildImageUrl(img)} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {auditorImages.length > 2 && (
                            <div className="w-10 h-10 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                              onClick={() => { setSelectedImages(auditorImages.map(im => buildImageUrl(im))); setCurrentImageIndex(2); setShowImageModal(true); }}>
                              +{auditorImages.length - 2}
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
                          {qcImages.slice(0, 2).map((img, i) => (
                            <div key={i} className="w-10 h-10 border border-gray-300 rounded overflow-hidden hover:opacity-75"
                              onClick={() => { setSelectedImages(qcImages.map(im => buildQcImageUrl(im))); setCurrentImageIndex(i); setShowImageModal(true); }}>
                              <img src={buildQcImageUrl(img)} alt="" className="w-full h-full object-cover" />
                            </div>
                          ))}
                          {qcImages.length > 2 && (
                            <div className="w-10 h-10 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-600 cursor-pointer"
                              onClick={() => { setSelectedImages(qcImages.map(im => buildQcImageUrl(im))); setCurrentImageIndex(2); setShowImageModal(true); }}>
                              +{qcImages.length - 2}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {allRemarksSubmitted ? (
                        <span className="text-sm text-gray-900">{item.auditor_qc_remark || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          value={remarks[item.qc_submission_item_id] || ''}
                          onChange={e => setRemarks(prev => ({ ...prev, [item.qc_submission_item_id]: e.target.value }))}
                          placeholder="Enter remark"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.qc_final_remark || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit */}
      {!allRemarksSubmitted && (
        <div className="flex justify-end">
          <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50" style={{ background: '#C50B34' }}>
            {submitting ? 'Submitting...' : 'Submit Remarks'}
          </button>
        </div>
      )}

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

export default AuditorQcFormView;
