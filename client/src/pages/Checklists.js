import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentIcon, DocumentTextIcon, EyeIcon, TrashIcon } from '@heroicons/react/24/outline';
import { checklistAPI, rosterAPI } from '../services/api';
import Modal from '../components/UI/Modal';
import Table from '../components/UI/Table';
import PageHeader from '../components/UI/PageHeader';
import BasicTimePicker from '../components/UI/TimePicker';
import useApi from '../hooks/useApi';
import useSearch from '../hooks/useSearch';
import Swal from 'sweetalert2';
import SearchableSelect from '../components/SearchableSelect';
import showToast from '../utils/toast';

const Checklists = () => {
  const navigate = useNavigate();
  const [allChecklists, setAllChecklists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState(null);
  const [viewingChecklist, setViewingChecklist] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState(null);
  const [selectedChecklistName, setSelectedChecklistName] = useState('');
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([{ auditor_id: '', manager_id: '', supervisor_id: '' }]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [departmentInput, setDepartmentInput] = useState('');
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [names, setNames] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedNameId, setSelectedNameId] = useState(null);
  const [filteredNames, setFilteredNames] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');

  const { loading, execute } = useApi();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm();
  const [alertTime, setAlertTime] = useState(null);
  const watchedCategory = watch('category_id');

  useEffect(() => {
    fetchChecklists();
    fetchCategories();
    fetchLocations();
    fetchDepartments();
    fetchNames();
    fetchUsers();
  }, []);

  // When location changes → fetch names for that location, reset name & dept
  useEffect(() => {
    if (selectedLocationId) {
      checklistAPI.getNames({ params: { locationId: selectedLocationId } })
        .then(res => setFilteredNames(res.data.names || []))
        .catch(() => setFilteredNames([]));
    } else {
      setFilteredNames([]);
    }
    setSelectedNameId(null);
    setNameInput('');
    setDepartmentInput('');
    setFilteredDepartments([]);
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
    setDepartmentInput('');
  }, [selectedNameId]);

  // Filter and paginate data
  const filteredChecklists = allChecklists.filter(checklist => 
    !searchTerm || 
    checklist.checklist_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    checklist.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    checklist.location_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPageSizeOptions = () => {
    const total = filteredChecklists.length || 0;
    if (total <= 100) return [25, 50, 100];
    if (total <= 250) return [50, 100, 250];
    return [100, 250, 500];
  };

  const handleItemsPerPageChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredChecklists.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedChecklists = filteredChecklists.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchUsers = async () => {
    await execute(
      () => rosterAPI.getUsers(),
      {
        onSuccess: (response) => setUsers(response.data.users || {}),
        errorMessage: 'Unable to load users. Please try again.',
        showLoading: false
      }
    );
  };

  useEffect(() => {
    if (watchedCategory) {
      const category = categories.find(c => c.id === parseInt(watchedCategory));
      setSelectedCategory(category);
    }
  }, [watchedCategory, categories]);

  const fetchCategories = async () => {
    await execute(
      () => checklistAPI.getCategories(),
      {
        onSuccess: (response) => setCategories(response.data.categories || []),
        errorMessage: 'Unable to load categories. Please refresh the page.',
        showLoading: false
      }
    );
  };

  const fetchLocations = async () => {
    await execute(
      () => checklistAPI.getLocations(),
      {
        onSuccess: (response) => setLocations(response.data.locations || []),
        showLoading: false
      }
    );
  };

  const fetchDepartments = async () => {
    await execute(
      () => checklistAPI.getDepartments(),
      {
        onSuccess: (response) => setDepartments(response.data.departments || []),
        showLoading: false
      }
    );
  };

  const fetchNames = async () => {
    await execute(
      () => checklistAPI.getNames(),
      {
        onSuccess: (response) => setNames(response.data.names || []),
        showLoading: false
      }
    );
  };

  const fetchChecklists = async () => {
    await execute(
      () => checklistAPI.getChecklists({ page: 1, limit: 1000 }),
      {
        onSuccess: (response) => setAllChecklists(response.data.data || []),
        errorMessage: 'Unable to load checklists. Please refresh the page.'
      }
    );
  };

  const handleCreateChecklist = () => {
    setEditingChecklist(null);
    reset();
    setSelectedCategory(null);
    setCsvFile(null);
    setLocationInput('');
    setDepartmentInput('');
    setNameInput('');
    setSelectedLocationId(null);
    setShowLocationDropdown(false);
    setShowDepartmentDropdown(false);
    setShowNameDropdown(false);
    setAssignments([{ auditor_id: '', manager_id: '', supervisor_id: '' }]);
    // Set default alert time to 23:59
    setValue('alert_time', '23:59');
    setIsModalOpen(true);
  };

  const handleAssignUsers = async (checklistId) => {
    setSelectedChecklistId(checklistId);
    await fetchUsers();
    
    const checklist = allChecklists.find(c => c.id === checklistId);
    if (checklist) {
      setSelectedChecklistName(checklist.checklist_name || '');
      setLocationInput(checklist.location_name || '');
      setNameInput(checklist.facility_name || checklist.name || '');
      setDepartmentInput(checklist.department_name || '');
    }
    
    // Fetch existing roster assignments from rosters table
    try {
      const response = await rosterAPI.getRosters();
      const rosters = response.data.rosters || [];
      const existingRoster = rosters.find(r => r.id === checklistId);
      
      if (existingRoster && existingRoster.auditor_id) {
        setAssignments([{
          auditor_id: String(existingRoster.auditor_id || ''),
          roster_id: existingRoster.roster_id || null,
          manager_id: '',
          supervisor_id: ''
        }]);
      } else {
        setAssignments([{ auditor_id: '', roster_id: null, manager_id: '', supervisor_id: '' }]);
      }
    } catch (error) {
      setAssignments([{ auditor_id: '', roster_id: null, manager_id: '', supervisor_id: '' }]);
    }
    
    setIsAssignModalOpen(true);
  };

  const addAssignment = () => {
    setAssignments([...assignments, { auditor_id: '', manager_id: '', supervisor_id: '' }]);
  };

  const removeAssignment = (index) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const updateAssignment = async (index, field, value) => {
    const updated = [...assignments];
    updated[index][field] = value;
    
    // Auto-assign manager and supervisor when auditor is selected
    if (field === 'auditor_id' && value) {
      const checklist = allChecklists.find(c => c.id === selectedChecklistId);
      
      if (checklist) {
        // Find manager based on checklist's location_id and name_id
        const manager = (users.all || []).find(u => 
          u.role_name === 'Manager' && 
          u.location_id === checklist.location_id &&
          u.name_id === checklist.name_id
        );
        
        // Find supervisor based on checklist's location_id, name_id and department_id
        const supervisor = (users.all || []).find(u => 
          u.role_name === 'Supervisor' && 
          u.location_id === checklist.location_id &&
          u.name_id === checklist.name_id &&
          u.department_id === checklist.department_id
        );
        
        if (manager) updated[index]['manager_id'] = String(manager.id);
        if (supervisor) updated[index]['supervisor_id'] = String(supervisor.id);
      }
    }
    
    setAssignments(updated);
  };

  const handleAssignSubmit = async () => {
    const assignment = assignments[0];
    
    // Handle unselect case
    if (assignment.auditor_id === 'unselect') {
      await execute(
        () => rosterAPI.manualAssign({
          checklist_id: selectedChecklistId,
          roster_id: assignment.roster_id || null,
          auditor_id: null,
          manager_id: null,
          supervisor_id: null,
          assigned_date: new Date().toISOString().split('T')[0]
        }),
        {
          onSuccess: () => {
            setIsAssignModalOpen(false);
            fetchChecklists();
          },
          successMessage: 'User unassigned successfully',
          errorMessage: 'Unable to unassign user. Please try again.',
          showLoading: false
        }
      );
      return;
    }
    
    if (!assignment.auditor_id) {
      showToast('error', 'Please select an auditor');
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    await execute(
      () => rosterAPI.manualAssign({
        checklist_id: selectedChecklistId,
        roster_id: assignment.roster_id || null,
        auditor_id: assignment.auditor_id || null,
        manager_id: assignment.manager_id || null,
        supervisor_id: assignment.supervisor_id || null,
        assigned_date: today
      }),
      {
        onSuccess: () => {
          setIsAssignModalOpen(false);
          fetchChecklists();
        },
        successMessage: 'Users assigned successfully',
        errorMessage: 'Unable to assign users. Please try again.',
        showLoading: false
      }
    );
  };

  const handleEditChecklist = (checklistId) => {
    // Navigate to edit page instead of opening modal
    navigate(`/checklist/${checklistId}/edit`);
  };

  const handleViewChecklist = async (checklistId) => {
    try {
      const response = await checklistAPI.getChecklist(checklistId);
      const checklist = response.data.checklist;
      
      // Get category, location, department, name details
      const categoryName = checklist.category_id ? categories.find(c => c.id === checklist.category_id)?.name : null;
      const locationName = checklist.location_id ? locations.find(l => l.id === checklist.location_id)?.name : null;
      const departmentName = checklist.department_id ? departments.find(d => d.id === checklist.department_id)?.name : null;
      const facilityName = checklist.name_id ? names.find(n => n.id === checklist.name_id)?.name : null;
      
      setViewingChecklist({
        ...checklist,
        category_name: categoryName,
        location_name: locationName,
        department_name: departmentName,
        facility_name: facilityName
      });
      setIsViewModalOpen(true);
    } catch (error) {
      showToast('error', 'Failed to fetch checklist details.');
    }
  };

  const handleDeleteChecklist = async (checklistId) => {
    const checklist = allChecklists.find(c => c.id === checklistId);
    const result = await Swal.fire({
      title: 'Delete Checklist',
      text: `Are you sure you want to delete "${checklist?.checklist_name}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      width: '400px',
      padding: '0.5rem',
      heightAuto: false,
      customClass: {
        popup: 'swal-compact'
      }
    });

    if (!result.isConfirmed) return;

    try {
      await checklistAPI.deleteChecklist(checklistId);
      await fetchChecklists();
      showToast('success', 'Checklist deleted successfully');
    } catch (error) {
      showToast('error', 'Failed to delete checklist');
    }
  };

  const onSubmit = async (data) => {
    const formData = new FormData();

    // Add form fields, EXCLUDING location_input, department_input, and name_input (handled separately)
    Object.keys(data).forEach(key => {
      if (key !== 'location_input' && key !== 'department_input' && key !== 'name_input' && data[key] !== undefined && data[key] !== '') {
        formData.append(key, data[key]);
      }
    });

    // Add CSV file if selected
    if (csvFile) {
      formData.append('checklist_file', csvFile);
    }

    // Add roster assignments if any
    const validAssignments = assignments.filter(a => a.auditor_id);
    if (validAssignments.length > 0) {
      formData.append('roster_assignments', JSON.stringify(validAssignments));
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

    // Always send department_input if provided (backend will check location+department combination)
    if (departmentInput && departmentInput.trim()) {
      formData.append('department_input', departmentInput);
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

    const apiCall = editingChecklist 
      ? () => checklistAPI.updateChecklist(editingChecklist.id, formData)
      : () => checklistAPI.createChecklist(formData);
    
    const successMessage = editingChecklist
      ? 'Checklist updated successfully'
      : validAssignments.length > 0 
        ? 'Checklist created and users assigned successfully'
        : 'Checklist created successfully';

    await execute(
      apiCall,
      {
        onSuccess: async () => {
          setIsModalOpen(false);
          await Promise.all([
            fetchChecklists(),
            fetchLocations(),
            fetchDepartments(),
            fetchNames()
          ]);
        },
        successMessage,
        errorMessage: editingChecklist 
          ? 'Unable to update checklist. Please check your inputs and try again.'
          : 'Unable to create checklist. Please check your inputs and try again.',
        showLoading: false
      }
    );
  };

  const renderDynamicFields = () => {
    if (!selectedCategory || !selectedCategory.required_fields) return null;

    const fields = selectedCategory.required_fields;
    const needsDepartment = fields && fields.includes('department');

    return (
      <div className="space-y-6">
        {/* Location Field */}
        {fields && fields.includes('location') && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
            <div className="relative">
              <input
                {...register('location_input')}
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
              {showLocationDropdown && locations && locations.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg" style={{maxHeight: '8rem', overflowY: 'auto'}}>
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
                          setValue('location_input', location.name);
                          setValue('name_input', '', { shouldValidate: false });
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
        {fields && fields.includes('name') && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <div className="relative">
              <input
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setValue('name_input', e.target.value, { shouldValidate: true });
                }}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                placeholder="Select or enter facility name"
                className="input-field w-full pr-8"
                autoComplete="off"
              />
              <input
                {...register('name_input', { required: 'Name is required' })}
                type="hidden"
                value={nameInput}
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
                          setValue('name_input', name.name, { shouldValidate: true });
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
            {errors.name_input && <p className="text-red-600 text-sm mt-1">{errors.name_input.message}</p>}
          </div>
        )}

        {/* Department Field */}
        {needsDepartment && (
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <div className="relative">
              <input
                {...register('department_input')}
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
                          setValue('department_input', department.name);
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
        {fields && fields.includes('camera_count') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Camera Count *</label>
            <input
              {...register('camera_count', { required: 'Camera count is required', min: 0 })}
              type="number"
              min="0"
              placeholder="Enter number of cameras"
              className="input-field w-full"
            />
            {errors.camera_count && <p className="text-red-600 text-sm mt-1">{errors.camera_count.message}</p>}
          </div>
        )}



        {/* Checklist File */}
        {fields && fields.includes('checklist') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Checklist File</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setCsvFile(e.target.files[0])}
              className="input-field w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Accepts CSV and Excel files. For Excel files with multiple sheets, only the active sheet will be processed.</p>
            {/* <div className="mt-2 text-xs text-gray-500">
              <p><strong>Bulk Checklist Creation CSV Format:</strong> Create multiple checklists with items</p>
              <div className="mt-2">
                <p><strong>Required Columns:</strong> Category, Location, Name, Department, Checklist Name</p>
                <p><strong>Optional Item Columns:</strong> Type, PROCESS, Camera number, Criticality, ACTIVITIES, Who, When, How, Frequency</p>
                <div className="bg-gray-50 p-2 rounded text-xs font-mono">
                  Category,Location,Name,Department,Checklist Name,Type,PROCESS,ACTIVITIES<br/>
                  Safety,Mumbai,Factory A,Production,Daily Safety Check,Safety,Check helmets,Verify all workers wear helmets<br/>
                  Quality,Delhi,Factory B,QC,Quality Control Audit,Quality,Check products,Inspect product quality<br/>
                  Hygiene,Bangalore,Factory C,Cleaning,Hygiene Inspection,Hygiene,Clean surfaces,Sanitize work areas
                </div>
                <p className="mt-2 text-blue-600"><strong>Result:</strong> Each row creates a checklist with its first checklist item</p>
                <p className="mt-1 text-green-600"><strong>Note:</strong> Categories, Locations, Names, and Departments will be created automatically if they don't exist</p>
              </div>
            </div> */}
            {csvFile && (
              <p className="text-xs text-green-600 mt-1">✓ {csvFile.name} selected</p>
            )}
          </div>
        )}

        {/* Initial User Assignments - COMMENTED OUT */}
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Initial User Assignments (Optional)</label>
          <div className="space-y-3">
            {assignments.map((assignment, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Assignment {index + 1}</span>
                  {assignments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAssignment(index)}
                      className="text-red-600 hover:text-red-800 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={assignment.auditor_id}
                    onChange={(e) => updateAssignment(index, 'auditor_id', e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="">Select Auditor</option>
                    {(users.auditors || []).map(user => (
                      <option key={user.id} value={user.id}>{user.full_name}</option>
                    ))}
                  </select>
                  <div className="input-field w-full text-sm bg-gray-50">
                    {assignment.manager_id ? 
                      (users.all || []).find(u => u.id == assignment.manager_id)?.full_name || 'Auto-assigned'
                      : 'Auto-assigned'
                    }
                  </div>
                  <div className="input-field w-full text-sm bg-gray-50">
                    {assignment.supervisor_id ? 
                      (users.all || []).find(u => u.id == assignment.supervisor_id)?.full_name || 'Auto-assigned'
                      : 'Auto-assigned'
                    }
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addAssignment}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors text-sm"
            >
              + Add Assignment
            </button>
          </div>
        </div> */}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Create Checklist">
        <div className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Search checklists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <a
            href="data:text/csv;charset=utf-8,Type%2CPROCESS%2CCamera%20number%2CCriticality%2CACTIVITIES%2CWho%2CWhen%2CHow%2CFrequency%0ANSC%2CRM%20storage%2CNVR%203-%20%20Camera%2005%20%2CLow%2CCheck%20wehther%20the%20materials%20are%20stored%20on%20pallets.%2CCL%20staff%2CAll%20time%2CManual%2CDaily%0ANSC%2CRM%20storage%2CNVR%203-%20%20Camera%2005%20%2CLow%2CAll%20the%20raw%20materials%20are%20stored%20with%20a%20minimum%20distance%20from%20wall.%2CCL%20staff%2CAll%20time%2CManual%2CDaily%0ANSC%2CGrinding%2CNVR%203-%20%20Camera%2004%20%2CHigh%2CCheck%20grinders%20are%20cleaned%20properly.%2CCL%20staff%2CBefore%20starting%20process%2CManual%2COnce%20in%20a%20day%0ANSC%2CGrinding%2CNVR%203-%20%20Camera%2004%20%2CHigh%2CCheck%20whether%20daily%20maintenace%20check%20are%20done%20properly.%2CProduction%20operator%2CBefore%20starting%20process%2CManual%2COnce%20in%20a%20day%0ANSC%2CGrinding%2CNVR%203-%20%20Camera%2004%20%2CHigh%2CWorkers%20are%20following%20proper%20hygiene%20practices%20during%20production.%2CCL%20staff%2CDuring%20process%2CManual%2CEvery%20batch%0ANSC%2CGrinding%2CNVR%203-%20%20Camera%2004%20%2CHigh%2CCheck%20post%20production%20cleaning%20was%20done%20properly.%2CCL%20staff%2CAfter%20%20process%2CManual%2COnce%20in%20a%20day%0ANSC%2CRinsing%2CNVR%203-%20%20Camera%2003%20%2CHigh%2CAll%20the%20raw%20materials%20are%20cleaned%20properly%20before%20soaking.%2CCL%20staff%2CBefore%20process%2CManual%2CEvery%20batch%0ANSC%2CRinsing%2CNVR%203-%20%20Camera%2003%20%2CHigh%2CCheck%20the%20vessesl%20used%20for%20process%20are%20cleaned%20properly%20on%20daily%20basis.%2CCL%20staff%2CAfter%20%20process%2CManual%2CEvery%20batch%0ANSC%2CHot%20water%20Tank%2CNVR%203-%20%20Camera%2006%20%2CHigh%2CCheck%20the%20hot%20water%20temperature%20at%2085*C%20before%20taken%20for%20usage.%2CCL%20staff%2CBefore%20starting%20process%2CDigital%2COnce%20in%20a%20day%0ANSC%2CWeighing%20scale%2CNVR%203-%20%20Camera%2002%20%2CHigh%2CCheck%20wehether%20weighing%20scale%20are%20calibrated%20at%20regular%20intervals.%2CSupervisor%2CDuring%20process%2CDigital%2CRegular%20intervals%0ANSC%2CWeighing%20scale%2CNVR%203-%20%20Camera%2002%20%2CHigh%2CWeighment%20need%20to%20be%20done%20properly%20as%20per%20the%20requirement.%2CCL%20staff%2CBefore%20starting%20process%2CManual/%20Digital%2CEach%20batch%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CCheck%20whether%20balance%20tank%20cleaned%20properly%20before%20start%20up.%2CCL%20staff%2CBefore%20starting%20process%2CManual%2COnce%20in%20a%20day%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CInitial%20volume%20has%20to%20be%20drained%20to%20avoid%20water%20mix%20up%20from%20the%20line.%2CCL%20staff%2CBefore%20filling%2CManual%2COnce%20in%20a%20day%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CWorkers%20are%20following%20proper%20hygiene%20practices%20during%20production.%2CCL%20staff%2CDuring%20process%2CManual%2CEvery%20batch%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CCheck%20whether%20sealing%20integrity%20was%20checked%20at%20regular%20intervals.%2CSupervisor/%20CL%20staff%2CDuring%20packing%2CManual%2CEvery%20batch%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CCheck%20after%20packing%20immediate%20storage%20was%20done%20in%20the%20refrigerator.%2CCL%20staff%2CAfter%20process%2CManual%2CEvery%20package%0ANSC%2CFilling%20Area%2CNVR%203-%20%20Camera%2001%20%2CHigh%2CCheck%20whether%20FG%20are%20moved%20to%20cold%20room%20at%20regular%20intervals.%2CCL%20staff%2CAfter%20process%2CManual%2CRegular%20intervals%0ANSC%2CCoding%20Area%2CNVR%203-%20Camera%2007%2CHigh%2CCheck%20all%20the%20packing%20materials%20are%20coded%20before%20taking%20into%20packing.%2CCL%20staff%2CBefore%20filling%20process%2CManual%2CEach%20Packing%20material%0ANSC%2CCoding%20Area%2CNVR%203-%20Camera%2007%2CHigh%2CEnsure%20the%20cleaning%20of%20PM%20storage%20area.%2CCL%20staff%2CAfter%20process%2CManual%2CEach%20Packing%20material%0ANSC%2COverall%20View%2CNVR%20-%202%20Camera%2025%2CLow%2CEnsure%20over%20all%20shop%20floor%20was%20cleaned%20properly%20on%20daily%20basis.%2CCL%20staff%2CDaily%2CManual%2COnce%20in%20a%20day"
            download="sample-checklist-template.csv"
            className="btn-export text-xs flex items-center space-x-1 no-underline"
          >
            <DocumentTextIcon className="w-4 h-4" />
            <span>Sample Checklist</span>
          </a>
          <button
            onClick={handleCreateChecklist}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Create Checklist</span>
          </button>
        </div>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg">
        <div className="overflow-x-auto">
          <div className="overflow-y-auto scroll-container" style={{ maxHeight: '65vh' }}>
            <table className="min-w-full">
            <thead style={{backgroundColor: '#ededed'}} className="border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Frequency</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Camera Count</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                {/* <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Roster</th> */}
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              ) : paginatedChecklists.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-center text-gray-500">No checklists found</td>
                </tr>
              ) : (
                paginatedChecklists.map((checklist, index) => (
                  <tr key={checklist.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{checklist.checklist_name} <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">{checklist.item_type}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{checklist.category_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{checklist.location_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{checklist.frequency}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{checklist.camera_count}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                        Active
                      </span>
                    </td>
                    {/* <td className="px-4 py-3">
                      <button
                        onClick={() => handleAssignUsers(checklist.id)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                      >
                        View Users
                      </button>
                    </td> */}
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigate(`/checklist/${checklist.id}/view`)}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                          title="View"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditChecklist(checklist.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Edit"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteChecklist(checklist.id)}
                          className="p-1 text-gray-600 hover:text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span>Show:</span>
            {getPageSizeOptions().map(size => (
              <button
                key={size}
                onClick={() => handleItemsPerPageChange(size)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                  itemsPerPage === size
                    ? 'bg-btn-primary text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {size}
              </button>
            ))}
            <button
              onClick={() => handleItemsPerPageChange(filteredChecklists.length || 9999)}
              className={`px-3 py-1 rounded border text-xs font-medium transition-colors ${
                itemsPerPage >= (filteredChecklists.length || 9999)
                  ? 'bg-btn-primary text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
              }`}
            >
              All
            </button>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredChecklists.length)}</span> of <span className="font-medium">{filteredChecklists.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Create Checklist Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingChecklist ? "Edit Checklist" : "Create New Checklist"}
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              {...register('category_id', { required: 'Category is required' })}
              className="input-field w-full"
              style={{maxHeight: '8rem', overflowY: 'auto'}}
            >
              <option value="">Choose category type...</option>
              {categories && categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {errors.category_id && <p className="text-red-600 text-sm mt-1">{errors.category_id.message}</p>}
          </div>

          {/* Dynamic Fields in Grid */}
          {selectedCategory && (
            <div className="grid grid-cols-2 gap-4">
              {/* Location Details */}
              {selectedCategory.required_fields && selectedCategory.required_fields.includes('location') && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <div className="relative">
                    <input
                      {...register('location_input')}
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
                    {showLocationDropdown && locations && locations.length > 0 && (
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
                                setValue('location_input', location.name);
                                setValue('name_input', '', { shouldValidate: false });
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
                      onChange={(e) => {
                        setNameInput(e.target.value);
                        setValue('name_input', e.target.value, { shouldValidate: true });
                      }}
                      onFocus={() => setShowNameDropdown(true)}
                      onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                      placeholder="Select or enter facility name"
                      className="input-field w-full pr-8"
                      autoComplete="off"
                    />
                    <input
                      {...register('name_input', { required: 'Name is required' })}
                      type="hidden"
                      value={nameInput}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    {showNameDropdown && filteredNames.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg" style={{maxHeight: '8rem', overflowY: 'auto'}}>
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
                                setValue('name_input', name.name, { shouldValidate: true });
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
                  {errors.name_input && <p className="text-red-600 text-sm mt-1">{errors.name_input.message}</p>}
                </div>
              )}

              {/* Department Field */}
              {selectedCategory.required_fields && selectedCategory.required_fields.includes('department') && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <div className="relative">
                    <input
                      {...register('department_input')}
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
                                setValue('department_input', department.name);
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
                  style={{maxHeight: '8rem', overflowY: 'auto'}}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Checklist File *</label>
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => setCsvFile(e.target.files[0])}
                className="input-field w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Accepts CSV and Excel files. For Excel files with multiple sheets, only the active sheet will be processed.</p>
              {csvFile && (
                <p className="text-xs text-green-600 mt-1">✓ {csvFile.name} selected</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedCategory || loading}
              className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editingChecklist ? 'Updating...' : 'Creating...') : (editingChecklist ? 'Update' : 'Save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* User Assignment Modal */} 
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Assign Users to "${selectedChecklistName}"`}
        size="xl"
      >
        <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                value={locationInput}
                readOnly
                className="input-field w-full bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                value={nameInput}
                readOnly
                className="input-field w-full bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                value={departmentInput}
                readOnly
                className="input-field w-full bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auditor</label>
              <input
                value={(users.auditors || []).find(u => u.id == assignments[0]?.auditor_id)?.username || 'Unassigned'}
                readOnly
                className="input-field w-full bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Supervisor and Manager will be auto-assigned based on location, name, and department
              </p>
            </div>
        </div>

        <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
          <button
            onClick={() => setIsAssignModalOpen(false)}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </Modal>

      {/* View Checklist Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewingChecklist(null);
        }}
        title="Checklist Details"
        size="xl"
      >
        {viewingChecklist && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Checklist Name</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.checklist_name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.category_name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.location_name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.facility_name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.department_name || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.frequency}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audit Count</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.audit_count}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alert Time</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.alert_time}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Camera Count</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {viewingChecklist.camera_count || 'N/A'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                  <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                    Active
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {new Date(viewingChecklist.created_at).toLocaleDateString()}
                </div>
              </div>
              {viewingChecklist.checklist_file && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Checklist File</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900">
                    {viewingChecklist.checklist_file}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4 mt-4 border-t border-gray-200">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Checklists;