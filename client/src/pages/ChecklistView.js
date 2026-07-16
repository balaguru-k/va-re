import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { checklistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/UI/PageHeader';
import useApi from '../hooks/useApi';

const ChecklistView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, execute } = useApi();
  
  // Check if user is Super Admin
  useEffect(() => {
    if (user && user.role !== 'Super Admin') {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);
  
  // Data states
  const [checklist, setChecklist] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  
  // Master data
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  
  // Accordion states
  const [basicInfoOpen, setBasicInfoOpen] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(true);

  useEffect(() => {
    fetchChecklist();
    fetchMasterData();
  }, [id]);

  useEffect(() => {
    if (checklist && categories.length > 0) {
      const category = categories.find(c => c.id === checklist.category_id);
      setSelectedCategory(category);
    }
  }, [checklist, categories]);

  const fetchMasterData = async () => {
    await execute(() => checklistAPI.getCategories(), {
      onSuccess: (response) => setCategories(response.data.categories || []),
      showLoading: false
    });
  };

  const fetchChecklist = async () => {
    await execute(
      () => checklistAPI.getChecklist(id),
      {
        onSuccess: (response) => {
          const checklistData = response.data.checklist;
          setChecklist(checklistData);
        },
        errorMessage: 'Failed to fetch checklist details'
      }
    );

    // Fetch checklist items
    await execute(
      () => checklistAPI.getChecklistItems(id),
      {
        onSuccess: (response) => {
          setChecklistItems(response.data.items || []);
        },
        showLoading: false
      }
    );
  };

  if (!checklist) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-5">
      <PageHeader title={`View Checklist: ${checklist.checklist_name}`}>
        <button
          onClick={() => navigate('/checklists')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back to Checklists
        </button>
      </PageHeader>

      {/* Basic Information Accordion */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="border-b border-gray-200">
          <button
            onClick={() => setBasicInfoOpen(!basicInfoOpen)}
            className="w-full px-4 py-3 text-left bg-[#f3f3f3] hover:bg-[#f3f3f3] border-b border-gray-200 flex justify-between items-center"
          >
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            {basicInfoOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            )}
          </button>
          
          {basicInfoOpen && (
            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {selectedCategory?.name || 'N/A'}
                  </div>
                </div>

                {/* Checklist Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Checklist Name</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.checklist_name || 'N/A'}
                  </div>
                </div>

                {/* Location */}
                {selectedCategory?.required_fields?.includes('location') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {checklist.location_name || 'N/A'}
                    </div>
                  </div>
                )}

                {/* Name/Facility */}
                {selectedCategory?.required_fields?.includes('name') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Facility Name</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {checklist.facility_name || 'N/A'}
                    </div>
                  </div>
                )}

                {/* Department */}
                {selectedCategory?.required_fields?.includes('department') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {checklist.department_name || 'N/A'}
                    </div>
                  </div>
                )}

                {/* Camera Count */}
                {selectedCategory?.required_fields?.includes('camera_count') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Camera Count</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                      {checklist.camera_count || 'N/A'}
                    </div>
                  </div>
                )}

                {/* Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.frequency || 'N/A'}
                  </div>
                </div>

                {/* Audit Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Audit Count</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.audit_count || 'N/A'}
                  </div>
                </div>

                {/* Alert Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alert Time</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.alert_time || 'N/A'}
                  </div>
                </div>

                {/* Checklist File */}
                {selectedCategory?.required_fields?.includes('checklist') && checklist.checklist_file && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Checklist File</label>
                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                      📄 {checklist.checklist_file}
                    </div>
                  </div>
                )}

                {/* Created Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created Date</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.created_at ? new Date(checklist.created_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Updated</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {checklist.updated_at ? new Date(checklist.updated_at).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Activities & Process Items Accordion */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="border-b border-gray-200">
          <button
            onClick={() => setItemsOpen(!itemsOpen)}
            className="w-full px-4 py-3 text-left bg-[#f3f3f3] hover:bg-[#f3f3f3] border-b border-gray-200 flex justify-between items-center"
          >
            <h3 className="text-lg font-medium text-gray-900">
              Activities & Process Items ({checklistItems.length} items)
            </h3>
            {itemsOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            )}
          </button>
          
          {itemsOpen && (
            <div className="px-6 py-6">
              {checklistItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No checklist items found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead style={{backgroundColor: 'rgb(237, 237, 237)'}}>
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">S.No</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">Activities</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">Process</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">Criticality</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {checklistItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.activities || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.process || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              item.criticality === 'High' ? 'bg-red-100 text-red-800' :
                              item.criticality === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {item.criticality || 'Medium'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistView;