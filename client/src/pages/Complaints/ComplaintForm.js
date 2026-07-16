import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { complaintAPI, checklistAPI } from '../../services/api';
import PageHeader from '../../components/UI/PageHeader';
import { CameraIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ComplaintForm = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    location_id: '',
    department_id: '',
    issue: [],
    remarks: '',
    attachment: null
  });

  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);

  const issuesList = [
    { label: 'Online', value: 'online', color: '#03fc4e' },
    { label: 'Slow Streaming', value: 'slow streaming', color: '#fcec03' },
    { label: 'No Video', value: 'No Video', color: '#0349fc' },
    { label: 'Offline', value: 'offline', color: '#fc0317' },
    { label: 'Sensor Issue', value: 'sensor issue', color: '#b103fc' },
    { label: 'Streaming Not Ready', value: 'streaming not ready', color: '#87818a' },
    { label: 'Timing Mismatch', value: 'Timimg mismatch', color: '#8f5a32' },
    { label: 'Playback Issue', value: 'Playback issue', color: '#b1d188' },
    { label: 'Camera Offline', value: 'Camera Offline', color: '#ff00ff' },
    { label: 'Goes Offline Often', value: 'Goes offline often', color: '#f2a830' }
  ];

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    if (formData.location_id) {
      fetchDepartments(formData.location_id);
    } else {
      setDepartments([]);
    }
  }, [formData.location_id]);

  const fetchLocations = async () => {
    try {
      const response = await checklistAPI.getLocations();
      setLocations(response.data.locations || []);
    } catch (error) {
      toast.error('Failed to load locations');
    }
  };

  const fetchDepartments = async (locationId) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/checklists/departments?locationId=${locationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter departments if the API doesn't support server-side filtering by locationId
      // In the real app, the API might return all departments or those for the location.
      setDepartments(response.data.departments || []);
    } catch (error) {
      toast.error('Failed to load departments');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIssueToggle = (issueValue) => {
    setFormData(prev => {
      const newIssues = prev.issue.includes(issueValue)
        ? prev.issue.filter(i => i !== issueValue)
        : [...prev.issue, issueValue];
      return { ...prev, issue: newIssues };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, attachment: file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera");
      setShowCamera(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFormData(prev => ({ ...prev, attachment: file }));
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }, 'image/jpeg');
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.location_id || formData.issue.length === 0) {
      toast.error('Please fill in required fields (Location and at least one Issue)');
      return;
    }

    const data = new FormData();
    data.append('location_id', formData.location_id);
    data.append('department_id', formData.department_id);
    data.append('issue', JSON.stringify(formData.issue));
    data.append('remarks', formData.remarks);
    if (formData.attachment) {
      data.append('images', formData.attachment); // backend expects 'images' field for combinedUpload
    }

    setLoading(true);
    try {
      await complaintAPI.createComplaint(data);
      toast.success('Complaint submitted successfully');
      navigate('/complaints/checklist');
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(error.response?.data?.error || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Submit Complaint" />

      <form onSubmit={handleSubmit} className="bg-white border border-red-100 rounded-lg p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
            <select
              name="location_id"
              value={formData.location_id}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select Location</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Issue Checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Issues *</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {issuesList.map(issue => (
              <button
                key={issue.value}
                type="button"
                onClick={() => handleIssueToggle(issue.value)}
                className={`px-3 py-2 text-xs font-medium rounded-md border transition-all ${
                  formData.issue.includes(issue.value)
                    ? 'ring-2 ring-offset-1 ring-red-500 border-transparent text-white'
                    : 'border-gray-300 text-gray-700 bg-white hover:border-red-300'
                }`}
                style={{ 
                  backgroundColor: formData.issue.includes(issue.value) ? issue.color : 'white',
                  color: formData.issue.includes(issue.value) ? (['#fcec03', '#03fc4e', '#b1d188'].includes(issue.color) ? 'black' : 'white') : 'inherit'
                }}
              >
                {issue.label}
              </button>
            ))}
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
          <textarea
            name="remarks"
            value={formData.remarks}
            onChange={handleInputChange}
            rows="3"
            placeholder="Provide additional details..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
          ></textarea>
        </div>

        {/* Attachment/Camera */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">Attachment / Camera Image</label>
          
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <PhotoIcon className="w-5 h-5 text-gray-400" />
              <span>Upload File</span>
            </button>
            
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <CameraIcon className="w-5 h-5 text-gray-400" />
              <span>Take Photo</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf"
          />

          {previewUrl && (
            <div className="relative inline-block mt-4">
              <img src={previewUrl} alt="Preview" className="h-40 w-auto rounded-lg border border-gray-200 shadow-sm" />
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setFormData(prev => ({ ...prev, attachment: null }));
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Camera Modal overlay */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-[70vh] rounded-lg shadow-xl"
            ></video>
            <div className="flex space-x-6 mt-8">
              <button
                type="button"
                onClick={takePhoto}
                className="bg-white text-black p-4 rounded-full shadow-lg hover:scale-110 transition-transform"
              >
                <div className="w-8 h-8 rounded-full border-4 border-black"></div>
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700"
              >
                <XMarkIcon className="w-8 h-8" />
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#C50B34] text-white font-semibold rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ComplaintForm;
