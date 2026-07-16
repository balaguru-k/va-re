import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormatter';
import { buildImageUrl, downloadImage } from '../utils/checklistUtils';
import toast from 'react-hot-toast';

const AdminChecklistView = () => {
    const { checklistId } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [checklistData, setChecklistData] = useState({ checklist_info: null, submissions: [] });
    const [showDetails, setShowDetails] = useState(true);
    const [selectedImages, setSelectedImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);

    useEffect(() => {
        fetchChecklistData();
    }, [checklistId]);

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
        setLoading(true);
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/reports/checklist/${checklistId}/view`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChecklistData(response.data.data);
        } catch (error) {
            console.error('Error fetching checklist data:', error);
            toast.error('Failed to fetch checklist data');
        } finally {
            setLoading(false);
        }
    };

    const getCriticalityBadgeClass = (criticality) => {
        const classes = {
            'High': 'bg-red-100 text-red-800',
            'Medium': 'bg-yellow-100 text-yellow-800',
            'Low': 'bg-green-100 text-green-800',
            'New': 'bg-blue-100 text-blue-800'
        };
        return classes[criticality] || 'bg-gray-100 text-gray-800';
    };

    const formatTime = (seconds) => {
        if (!seconds) return '0h 00m 00s';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
        return `${m}m ${String(s).padStart(2, '0')}s`;
        };

    // Extract all items from all submissions for counting
    const allItems = checklistData.submissions.flatMap(submission => submission.items || []);

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
                                <button onClick={() => navigate(user?.role === 'Business Head' ? '/head/dashboard' : '/admin/dashboard')} className="text-gray-600 hover:text-gray-900">
                                    <ArrowLeftIcon className="w-5 h-5" />
                                </button>
                                <h1 className="text-2xl font-semibold text-gray-900">
                                    {checklistData.checklist_info?.checklist_name?.split(' - ')[0] || 'Checklist View'}
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                                    {checklistData.checklist_info?.department || 'Department'}
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                                    {checklistData.checklist_info?.location || 'Location'}
                                </span>
                                {checklistData.checklist_info?.date && checklistData.checklist_info.date !== 'N/A' && (
                                    <>
                                        <span className="text-gray-400">•</span>
                                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                                            {checklistData.checklist_info.date}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                    Total Submissions: {checklistData.submissions.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                                    High: {allItems.filter(item => item.criticality === 'High').length}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                                    Low: {allItems.filter(item => item.criticality === 'Low').length}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('New')}`}>
                                    New: {allItems.filter(item => item.criticality === 'New').length}
                                </span>
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                    Total: {allItems.length}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('High')}`}>
                                    NC High: {allItems.filter(item => item.criticality === 'High' && item.status === 'No').length}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCriticalityBadgeClass('Low')}`}>
                                    NC Low: {allItems.filter(item => item.criticality === 'Low' && item.status === 'No').length}
                                </span>
                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                    NC Total: {allItems.filter(item => item.status === 'No').length}
                                </span>
                            </div>
                        </div>
                        {user?.role !== 'Head' && (
                            <div className="flex gap-2">
                                <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                                    {checklistData.submissions[0]?.auditor_name || 'Unknown Auditor'}
                                </span>
                                <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                                    {formatTime(checklistData.submissions[0]?.time_taken_seconds)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6">
                    <div className="bg-white border border-red-100 rounded-lg overflow-hidden">
                        <div className="overflow-auto" style={{ maxHeight: '600px' }}>
                            <table className="min-w-full">
                                <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Activities</th>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Process</th>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Criticality</th>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Reason</th>
                                        <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Images</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {checklistData.submissions.map((submission) =>
                                        submission.items.map((item, itemIndex) => (
                                            <tr key={`${submission.data_id}-${itemIndex}`} className={itemIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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
                                                    <div className="flex space-x-2">
                                                        {item.images && item.images.length > 0 ? (
                                                            <div
                                                                className="flex space-x-2 cursor-pointer"
                                                                onClick={() => {
                                                                    setSelectedImages(item.images.map(img => buildImageUrl(img)));
                                                                    setCurrentImageIndex(0);
                                                                    setShowImageModal(true);
                                                                }}
                                                            >
                                                                {item.images.slice(0, 3).map((img, i) => (
                                                                    <div key={i} className="w-12 h-12 border border-gray-300 rounded overflow-hidden hover:opacity-75 transition-opacity">
                                                                        <img
                                                                            src={buildImageUrl(img)}
                                                                            alt={`Proof ${i + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                ))}
                                                                {item.images.length > 3 && (
                                                                    <div className="w-12 h-12 border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                                                                        +{item.images.length - 3}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : '-'
                                                        }
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

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

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(selectedImages[currentImageIndex]);
                            }}
                            className="absolute top-4 right-16 text-white hover:text-gray-300 bg-black bg-opacity-70 rounded-full p-2 z-10"
                            title="Download Image"
                        >
                            <ArrowDownTrayIcon className="w-6 h-6" />
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

export default AdminChecklistView;