import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { mastersAPI } from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import Modal from '../components/UI/Modal';
import showToast from '../utils/toast';
import Swal from 'sweetalert2';
import { PlusIcon, ChevronUpDownIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';

const SearchableSelect = ({ value, onChange, options, placeholder = 'Select', className = '' }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(''); }}
        className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-red-500 focus:border-red-500 text-left"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <XMarkIcon
              className="w-4 h-4 text-gray-400 hover:text-gray-600"
              onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
            />
          )}
          <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />
        </div>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-red-500 focus:border-red-500"
              autoFocus
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No results</li>
            ) : filtered.map(o => (
              <li
                key={o.id}
                onClick={() => { onChange(String(o.id)); setOpen(false); setQuery(''); }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                  String(o.id) === String(value) ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700'
                }`}
              >
                {o.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const TABS = ['Categories', 'Locations', 'Names', 'Departments'];
const PER_PAGE = 15;

const Masters = () => {
  const [activeTab, setActiveTab] = useState('Categories');
  const [data, setData] = useState([]);
  const [locations, setLocations] = useState([]);
  const [names, setNames] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedNameId, setSelectedNameId] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formName, setFormName] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editNameId, setEditNameId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [allCategories, setAllCategories] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [allNames, setAllNames] = useState([]);
  const [allDepartments, setAllDepartments] = useState([]);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await mastersAPI.getLocations();
      const locs = res.data.locations || [];
      setLocations(locs);
      setAllLocations(locs);
    } catch { /* ignore */ }
  }, []);

  const fetchAllNames = useCallback(async () => {
    try {
      const res = await mastersAPI.getNames();
      setAllNames(res.data.names || []);
    } catch { /* ignore */ }
  }, []);

  const fetchAllDepartments = useCallback(async () => {
    try {
      const res = await mastersAPI.getDepartments();
      setAllDepartments(res.data.departments || []);
    } catch { /* ignore */ }
  }, []);

  // Fetch names filtered by selected location (for Departments tab filter)
  const fetchNamesByLocation = useCallback(async (locId) => {
    try {
      if (!locId) { setNames([]); return; }
      const res = await mastersAPI.getNames(locId);
      setNames(res.data.names || []);
    } catch { setNames([]); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'Categories') {
        res = await mastersAPI.getCategories();
        const cats = res.data.categories || [];
        setData(cats);
        setAllCategories(cats);
      } else if (activeTab === 'Locations') {
        res = await mastersAPI.getLocations();
        const locs = res.data.locations || [];
        setData(locs);
        setLocations(locs);
        setAllLocations(locs);
      } else if (activeTab === 'Names') {
        res = await mastersAPI.getNames(selectedLocationId || undefined);
        setData(res.data.names || []);
        if (!selectedLocationId) setAllNames(res.data.names || []);
        else fetchAllNames();
      } else {
        res = await mastersAPI.getDepartments(selectedLocationId || undefined, selectedNameId || undefined);
        setData(res.data.departments || []);
        if (!selectedLocationId && !selectedNameId) setAllDepartments(res.data.departments || []);
        else fetchAllDepartments();
      }
    } catch {
      showToast('error', 'Failed to fetch data');
    }
    setLoading(false);
  }, [activeTab, selectedLocationId, selectedNameId, fetchAllNames, fetchAllDepartments]);

  useEffect(() => { fetchLocations(); fetchAllNames(); fetchAllDepartments(); }, [fetchLocations, fetchAllNames, fetchAllDepartments]);
  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSearch(''); setPage(1); }, [activeTab, selectedLocationId, selectedNameId]);

  // When location changes in Names or Departments tab, reset dependent filters
  useEffect(() => {
    if (activeTab === 'Departments' && selectedLocationId) {
      fetchNamesByLocation(selectedLocationId);
      setSelectedNameId('');
    }
  }, [selectedLocationId, activeTab, fetchNamesByLocation]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(item => {
      if (item.name?.toLowerCase().includes(q)) return true;
      if (item.location_name?.toLowerCase().includes(q)) return true;
      if (item.facility_name?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const startIndex = (page - 1) * PER_PAGE;
  const paginated = useMemo(() => filtered.slice(startIndex, startIndex + PER_PAGE), [filtered, startIndex]);

  useEffect(() => { setPage(1); }, [search]);

  const openAdd = () => {
    setEditItem(null);
    setFormName('');
    setEditLocationId(selectedLocationId);
    setEditNameId(selectedNameId);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormName(item.name);
    setEditLocationId(item.location_id || selectedLocationId);
    setEditNameId(item.name_id || selectedNameId);
    setModalOpen(true);
  };

  const checkDuplicate = (name, locId, nameId) => {
    const n = name.toLowerCase();
    if (activeTab === 'Categories') {
      return allCategories.some(c => c.name.toLowerCase() === n && c.id !== editItem?.id);
    } else if (activeTab === 'Locations') {
      return allLocations.some(l => l.name.toLowerCase() === n && l.id !== editItem?.id);
    } else if (activeTab === 'Names') {
      return allNames.some(f =>
        f.name.toLowerCase() === n &&
        String(f.location_id) === String(locId) &&
        f.id !== editItem?.id
      );
    } else {
      return allDepartments.some(d =>
        d.name.toLowerCase() === n &&
        String(d.location_id) === String(locId) &&
        String(d.name_id) === String(nameId) &&
        d.id !== editItem?.id
      );
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return showToast('error', 'Name is required');
    if (activeTab === 'Names' && !editItem && !editLocationId) return showToast('error', 'Select a location');
    if (activeTab === 'Departments' && !editItem) {
      if (!editLocationId) return showToast('error', 'Select a location');
      if (!editNameId) return showToast('error', 'Select a facility name');
    }
    if (checkDuplicate(formName.trim(), editLocationId, editNameId)) {
      let label;
      if (activeTab === 'Names') label = `"${formName.trim()}" already exists for this location`;
      else if (activeTab === 'Departments') label = `"${formName.trim()}" already exists for this facility`;
      else label = `"${formName.trim()}" already exists in ${activeTab}`;
      return showToast('error', label);
    }
    try {
      if (activeTab === 'Categories') {
        if (editItem) await mastersAPI.updateCategory(editItem.id, { name: formName.trim() });
        else await mastersAPI.createCategory({ name: formName.trim() });
      } else if (activeTab === 'Locations') {
        if (editItem) await mastersAPI.updateLocation(editItem.id, { name: formName.trim() });
        else await mastersAPI.createLocation({ name: formName.trim() });
      } else if (activeTab === 'Names') {
        if (editItem) await mastersAPI.updateName(editItem.id, { name: formName.trim() });
        else await mastersAPI.createName({ name: formName.trim(), location_id: parseInt(editLocationId) });
      } else {
        if (editItem) await mastersAPI.updateDepartment(editItem.id, { name: formName.trim() });
        else await mastersAPI.createDepartment({ name: formName.trim(), location_id: parseInt(editLocationId), name_id: parseInt(editNameId) });
      }
      showToast('success', editItem ? 'Updated successfully' : 'Created successfully');
      setModalOpen(false);
      fetchData();
      if (activeTab === 'Names') fetchAllNames();
      if (activeTab === 'Departments') fetchAllDepartments();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (item) => {
    const label = activeTab === 'Names' ? 'Facility Name' : activeTab.slice(0, -1);
    const result = await Swal.fire({
      title: `Delete ${label}?`,
      text: `Are you sure you want to delete "${item.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel'
    });
    if (!result.isConfirmed) return;
    try {
      if (activeTab === 'Categories') await mastersAPI.deleteCategory(item.id);
      else if (activeTab === 'Locations') await mastersAPI.deleteLocation(item.id);
      else if (activeTab === 'Names') await mastersAPI.deleteName(item.id);
      else await mastersAPI.deleteDepartment(item.id);
      showToast('success', `${label} deleted successfully`);
      fetchData();
      if (activeTab === 'Names') fetchAllNames();
      if (activeTab === 'Departments') fetchAllDepartments();
    } catch (err) {
      showToast('error', err.response?.data?.error || `Failed to delete ${label.toLowerCase()}`);
    }
  };

  const showLocationFilter = activeTab === 'Names' || activeTab === 'Departments';
  const showNameFilter = activeTab === 'Departments';
  const colSpan = activeTab === 'Departments' ? 5 : (activeTab === 'Names' ? 4 : 3);

  return (
    <div className="space-y-3">
      <PageHeader title="Masters Management">
        <div className="flex items-center space-x-3">
          {showLocationFilter && (
            <SearchableSelect
              value={selectedLocationId}
              onChange={(val) => { setSelectedLocationId(val); if (activeTab === 'Departments') setSelectedNameId(''); }}
              options={locations}
              placeholder="All Locations"
              className="w-48"
            />
          )}
          {showNameFilter && (
            <SearchableSelect
              value={selectedNameId}
              onChange={setSelectedNameId}
              options={selectedLocationId ? names : []}
              placeholder={selectedLocationId ? 'All Facilities' : 'Select location first'}
              className="w-48"
            />
          )}
          <input
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <button
            onClick={openAdd}
            className="px-3 py-2 text-xs font-medium text-white bg-btn-primary rounded transition-all duration-200 flex items-center space-x-1 hover:opacity-90"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add {activeTab === 'Names' ? 'Facility' : activeTab.slice(0, -1)}</span>
          </button>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setSelectedLocationId(''); setSelectedNameId(''); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-red-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {tab === 'Names' ? 'Facility Names' : tab}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-red-100 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">#</th>
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Name</th>
                {(activeTab === 'Names' || activeTab === 'Departments') && (
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Location</th>
                )}
                {activeTab === 'Departments' && (
                  <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Facility Name</th>
                )}
                <th className="px-4 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-gray-500">Loading</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-gray-500">No records found</td></tr>
              ) : paginated.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 text-sm text-gray-600">{startIndex + idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                  {(activeTab === 'Names' || activeTab === 'Departments') && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.location_name || locations.find(l => l.id === item.location_id)?.name || '-'}
                    </td>
                  )}
                  {activeTab === 'Departments' && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.facility_name || '-'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                        title="Delete"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Result per page: <span className="font-medium">{PER_PAGE}</span>
          </div>
          <div className="text-gray-600">
            <span className="font-medium">{filtered.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + PER_PAGE, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages || filtered.length === 0}
              className="px-3 py-2 text-lg font-bold text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editItem ? 'Edit' : 'Add'} ${activeTab === 'Names' ? 'Facility Name' : activeTab.slice(0, -1)}`} size="sm">
        <div className="space-y-4">
          {/* Location dropdown for Names (add only) */}
          {activeTab === 'Names' && !editItem && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <SearchableSelect
                value={editLocationId}
                onChange={setEditLocationId}
                options={locations}
                placeholder="-- Select Location --"
              />
            </div>
          )}
          {/* Location + Facility dropdowns for Departments (add only) */}
          {activeTab === 'Departments' && !editItem && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <SearchableSelect
                  value={editLocationId}
                  onChange={(val) => { setEditLocationId(val); setEditNameId(''); if (val) fetchNamesByLocation(val); }}
                  options={locations}
                  placeholder="-- Select Location --"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Name</label>
                <SearchableSelect
                  value={editNameId}
                  onChange={setEditNameId}
                  options={editLocationId ? names : []}
                  placeholder={editLocationId ? '-- Select Facility --' : 'Select location first'}
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="input-field w-full"
              placeholder={`Enter ${activeTab === 'Names' ? 'facility' : activeTab.slice(0, -1).toLowerCase()} name`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
            <button
              onClick={() => setModalOpen(false)}
              className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              {editItem ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Masters;
