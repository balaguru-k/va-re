import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { checklistAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/UI/PageHeader';
import BasicTimePicker from '../components/UI/TimePicker';
import useApi from '../hooks/useApi';
import Swal from 'sweetalert2';
import showToast from '../utils/toast';

const EditChecklist = () => {
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
  
  // Form states
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const [checklist, setChecklist] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  
  // Master data
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [names, setNames] = useState([]);
  
  // UI states
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [locationInput, setLocationInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedNameId, setSelectedNameId] = useState(null);
  const [filteredNames, setFilteredNames] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  
  const [basicInfoOpen, setBasicInfoOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(true);
  const [isSubmittingBasicInfo, setIsSubmittingBasicInfo] = useState(false);
  const [isSubmittingItems, setIsSubmittingItems] = useState(false);
  
  const watchedCategory = watch('category_id');

  useEffect(() => {
    fetchChecklist();
    fetchMasterData();
  }, [id]);

  // When location changes → fetch names for that location
  useEffect(() => {
    if (selectedLocationId) {
      checklistAPI.getNames({ params: { locationId: selectedLocationId } })
        .then(res => setFilteredNames(res.data.names || []))
        .catch(() => setFilteredNames([]));
    } else {
      setFilteredNames([]);
    }
  }, [selectedLocationId]);

  // When name is selected → fetch departments for that location + name
  useEffect(() => {
    if (selectedLocationId && selectedNameId) {
      checklistAPI.getDepartments({ params: { locationId: selectedLocationId, nameId: selectedNameId } })
        .then(res => setFilteredDepartments(res.data.departments || []))
        .catch(() => setFilteredDepartments([]));
    } else {
      setFilteredDepartments([]);
    }
  }, [selectedLocationId, selectedNameId]);

  useEffect(() => {
    if (watchedCategory && categories.length > 0) {
      const category = categories.find(c => c.id === parseInt(watchedCategory));
      setSelectedCategory(category);
    }
  }, [watchedCategory, categories]);

  const fetchMasterData = async () => {
    await Promise.all([
      execute(() => checklistAPI.getCategories(), {
        onSuccess: (response) => setCategories(response.data.categories || []),
        showLoading: false
      }),
      execute(() => checklistAPI.getLocations(), {
        onSuccess: (response) => setLocations(response.data.locations || []),
        showLoading: false
      }),
      execute(() => checklistAPI.getDepartments(), {
        onSuccess: (response) => setDepartments(response.data.departments || []),
        showLoading: false
      }),
      execute(() => checklistAPI.getNames(), {
        onSuccess: (response) => setNames(response.data.names || []),
        showLoading: false
      })
    ]);
  };

  const fetchChecklist = async () => {
    await execute(
      () => checklistAPI.getChecklist(id),
      {
        onSuccess: (response) => {
          const checklistData = response.data.checklist;
          setChecklist(checklistData);
          
          // Pre-populate form
          reset({
            category_id: checklistData.category_id?.toString() || '',
            checklist_name: checklistData.checklist_name || '',
            frequency: checklistData.frequency || '',
            audit_count: checklistData.audit_count || 1,
            alert_time: checklistData.alert_time || '',
            camera_count: checklistData.camera_count || ''
          });
          
          // Set inputs
          setLocationInput(checklistData.location_name || '');
          setDepartmentInput(checklistData.department_name || '');
          setNameInput(checklistData.facility_name || '');
          setSelectedLocationId(checklistData.location_id || null);
          setSelectedNameId(checklistData.name_id || null);
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

  const addNewItem = () => {
    const newItem = {
      id: `new_${Date.now()}`,
      activities: '',
      process: '',
      criticality: 'Medium',
      isNew: true
    };
    setChecklistItems([...checklistItems, newItem]);
  };

  const updateItem = (itemId, field, value) => {
    setChecklistItems(checklistItems.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const deleteItem = async (itemId) => {
    // If it's a new item (not saved to DB), just remove from state
    if (itemId.toString().startsWith('new_')) {
      setChecklistItems(checklistItems.filter(item => item.id !== itemId));
      return;
    }

    // Confirm deletion for existing items
    const result = await Swal.fire({
      title: 'Delete Item?',
      text: 'This will permanently delete this item from the checklist.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#DC143C',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      width: '350px',
      padding: '0.5rem',
      heightAuto: false,
      customClass: {
        popup: 'swal-compact'
      }
    });

    console.log('Swal result:', result);

    if (result.isConfirmed) {
      await execute(
        () => checklistAPI.deleteChecklistItem(itemId),
        {
          onSuccess: () => {
            setChecklistItems(checklistItems.filter(item => item.id !== itemId));
            showToast('success', 'Item deleted successfully');
          },
          errorMessage: 'Failed to delete item'
        }
      );
    }
  };

  const onSubmitBasicInfo = async (data) => {
    if (isSubmittingBasicInfo) return;
    setIsSubmittingBasicInfo(true);
    
    const formData = new FormData();

    // Add form fields
    Object.keys(data).forEach(key => {
      if (key !== 'location_input' && key !== 'department_input' && key !== 'name_input' && data[key] !== undefined && data[key] !== '') {
        formData.append(key, data[key]);
      }
    });

    // Add CSV file if selected
    if (csvFile) {
      formData.append('checklist_file', csvFile);
    }

    // Handle location from state variable
    if (locationInput && locationInput.trim()) {
      const existingLocation = locations.find(l => l.name.toLowerCase() === locationInput.toLowerCase());
      if (existingLocation) {
        formData.append('location_id', existingLocation.id);
      } else {
        formData.append('location_input', locationInput);
      }
    }

    // Handle department from state variable
    if (departmentInput && departmentInput.trim()) {
      const existingDepartment = departments.find(d => d.name.toLowerCase() === departmentInput.toLowerCase());
      if (existingDepartment) {
        formData.append('department_id', existingDepartment.id);
      } else {
        formData.append('department_input', departmentInput);
      }
    }

    // Handle name from state variable
    if (nameInput && nameInput.trim()) {
      const existingName = names.find(n => n.name.toLowerCase() === nameInput.toLowerCase());
      if (existingName) {
        formData.append('name_id', existingName.id);
      } else {
        formData.append('name_input', nameInput);
      }
    }

    await execute(
      () => checklistAPI.updateChecklist(id, formData),
      {
        onSuccess: () => {
          showToast('success', 'Checklist basic information updated successfully!');
          setIsSubmittingBasicInfo(false);
        },
        errorMessage: 'Failed to update checklist basic information',
        onError: () => setIsSubmittingBasicInfo(false)
      }
    );
  };

  const onSubmitItems = async () => {
    if (isSubmittingItems) return;
    setIsSubmittingItems(true);
    
    const itemsToUpdate = checklistItems.filter(item => !item.isNew);
    const itemsToCreate = checklistItems.filter(item => item.isNew);

    try {
      // Update existing items
      for (const item of itemsToUpdate) {
        await checklistAPI.updateChecklistItem(item.id, {
          activities: item.activities,
          process: item.process,
          criticality: item.criticality
        });
      }

      // Create new items
      for (const item of itemsToCreate) {
        await checklistAPI.createChecklistItem(id, {
          activities: item.activities,
          process: item.process,
          criticality: item.criticality
        });
      }

      showToast('success', 'Checklist items updated successfully!');

      await fetchChecklist();
      setIsSubmittingItems(false);
    } catch (error) {
      showToast('error', 'Failed to update checklist items');
      setIsSubmittingItems(false);
    }
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
      <PageHeader title={`Checklist Name: ${checklist.checklist_name}`}>
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
            <div className="px-6 pb-6">
              <form onSubmit={handleSubmit(onSubmitBasicInfo)} className="space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Category *</label>
                  <select
                    {...register('category_id', { required: 'Category is required' })}
                    className="input-field w-full"
                  >
                    <option value="">Choose category type...</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  {errors.category_id && <p className="text-red-600 text-sm mt-1">{errors.category_id.message}</p>}
                </div>

                {/* Dynamic Fields in Grid */}
                {selectedCategory && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Location Field */}
                    {selectedCategory.required_fields && selectedCategory.required_fields.includes('location') && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <div className="relative">
                          <input
                            value={locationInput}
                            onChange={(e) => setLocationInput(e.target.value)}
                            onFocus={() => setShowLocationDropdown(true)}
                            onBlur={() => setTimeout(() => setShowLocationDropdown(false), 200)}
                            placeholder="Select or enter location"
                            className="input-field w-full pr-8"
                            autoComplete="off"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {showLocationDropdown && locations.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {locations
                                .filter(loc => loc.name.toLowerCase().includes(locationInput.toLowerCase()))
                                .map(location => (
                                  <div
                                    key={location.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      setLocationInput(location.name);
                                      setSelectedLocationId(location.id);
                                      setNameInput('');
                                      setDepartmentInput('');
                                      setSelectedNameId(null);
                                      setShowLocationDropdown(false);
                                    }}
                                  >
                                    {location.name}
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Name Field */}
                    {selectedCategory.required_fields && selectedCategory.required_fields.includes('name') && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <div className="relative">
                          <input
                            value={nameInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            onFocus={() => setShowNameDropdown(true)}
                            onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                            placeholder="Select or enter facility name"
                            className="input-field w-full pr-8"
                            autoComplete="off"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {showNameDropdown && filteredNames.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredNames
                                .filter(name => name.name.toLowerCase().includes(nameInput.toLowerCase()))
                                .map(name => (
                                  <div
                                    key={name.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      setNameInput(name.name);
                                      setSelectedNameId(name.id);
                                      setDepartmentInput('');
                                      setShowNameDropdown(false);
                                    }}
                                  >
                                    {name.name}
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Department Field */}
                    {selectedCategory.required_fields && selectedCategory.required_fields.includes('department') && (
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <div className="relative">
                          <input
                            value={departmentInput}
                            onChange={(e) => setDepartmentInput(e.target.value)}
                            onFocus={() => setShowDepartmentDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDepartmentDropdown(false), 200)}
                            placeholder="Select or enter department"
                            className="input-field w-full pr-8"
                            autoComplete="off"
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {showDepartmentDropdown && filteredDepartments.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              {filteredDepartments
                                .filter(dept => dept.name.toLowerCase().includes(departmentInput.toLowerCase()))
                                .map(department => (
                                  <div
                                    key={department.id}
                                    className="px-3 py-2 cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      setDepartmentInput(department.name);
                                      setShowDepartmentDropdown(false);
                                    }}
                                  >
                                    {department.name}
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Camera Count */}
                    {selectedCategory.required_fields && selectedCategory.required_fields.includes('camera_count') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Camera Count *</label>
                        <input
                          {...register('camera_count', { min: 0 })}
                          type="number"
                          min="0"
                          placeholder="Enter number of cameras"
                          className="input-field w-full"
                        />
                      </div>
                    )}

                    {/* Checklist Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name *</label>
                      <input
                        {...register('checklist_name', { required: 'Checklist name is required' })}
                        placeholder="Enter checklist name"
                        autoComplete="off"
                        className="input-field w-full"
                      />
                      {errors.checklist_name && <p className="text-red-600 text-sm mt-1">{errors.checklist_name.message}</p>}
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                      <select
                        {...register('frequency', { required: 'Frequency is required' })}
                        className="input-field w-full"
                      >
                        <option value="">Select...</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                      {errors.frequency && <p className="text-red-600 text-sm mt-1">{errors.frequency.message}</p>}
                    </div>

                    {/* Audit Count */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Audit Count *</label>
                      <input
                        {...register('audit_count', { required: 'Audit count is required', min: 1 })}
                        type="number"
                        min="1"
                        placeholder="1"
                        className="input-field w-full"
                      />
                      {errors.audit_count && <p className="text-red-600 text-sm mt-1">{errors.audit_count.message}</p>}
                    </div>

                    {/* Alert Time */}
                    <div>
                      <BasicTimePicker 
                        value={watch('alert_time') || ''}
                        onChange={(value) => setValue('alert_time', value)}
                        error={errors.alert_time?.message}
                        disabled
                      />
                      <input
                        {...register('alert_time', { required: 'Alert time is required' })}
                        type="hidden"
                      />
                    </div>
                  </div>
                )}

                {/* Checklist File - Full Width */}
                {selectedCategory && selectedCategory.required_fields && selectedCategory.required_fields.includes('checklist') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Checklist File</label>
                    {checklist.checklist_file && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                        <span className="text-blue-700">Current file: {checklist.checklist_file}</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                      className="input-field w-full"
                    />
                    {csvFile && (
                      <p className="text-xs text-green-600 mt-1">✓ {csvFile.name} selected (will replace current file)</p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={loading || isSubmittingBasicInfo}
                    className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"  style={{
    background: 'linear-gradient(90deg, #DC143C 0%, #760B20 133.82%)'
  }}
                  >
                    {isSubmittingBasicInfo ? 'Updating...' : 'Update Basic Info'}
                  </button>
                </div>
              </form>
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
            <h3 className="text-lg font-medium text-gray-900">Activities & Process Items</h3>
            {itemsOpen ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            )}
          </button>
          
          {itemsOpen && (
            <div className="px-6 pb-6">
              <div className="space-y-4 mt-5">
                {/* Add New Item Button */}
                <div className="flex justify-end">
                  <button
                    onClick={addNewItem}
                    className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2"  style={{
    background: 'linear-gradient(90deg, #DC143C 0%, #760B20 133.82%)'
  }}
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Add New Item</span>
                  </button>
                </div>

                {/* Items Table */}
                {checklistItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No checklist items found. Add some items to get started.
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
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border-b">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {checklistItems.map((item, index) => (
                          <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {index + 1}
                              {item.isNew && <span className="ml-2 text-xs text-green-600">(New)</span>}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.activities || ''}
                                onChange={(e) => updateItem(item.id, 'activities', e.target.value)}
                                placeholder="Enter activities description"
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-0 focus:border-red-300 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.process || ''}
                                onChange={(e) => updateItem(item.id, 'process', e.target.value)}
                                placeholder="Enter process description"
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-0 focus:border-red-300 focus:outline-none"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={item.criticality || 'Medium'}
                                onChange={(e) => updateItem(item.id, 'criticality', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-0 focus:border-red-100 focus:outline-none"
                              >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Delete item"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Submit Items Button */}
                {checklistItems.length > 0 && (
                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                      onClick={onSubmitItems}
                      disabled={loading || isSubmittingItems}
                      className="px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"  style={{
    background: 'linear-gradient(90deg, #DC143C 0%, #760B20 133.82%)'
  }}
                    >
                      {isSubmittingItems ? 'Updating...' : 'Update Items'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditChecklist;