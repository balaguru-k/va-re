import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import showToast from '../utils/toast';
import PageHeader from '../components/UI/PageHeader';
import SearchableSelect from '../components/SearchableSelect';
import SearchableMultiSelect from '../components/SearchableMultiSelect';
import Swal from 'sweetalert2';

const RotationRoster = () => {
  const [options, setOptions] = useState([]);
  const [activeOptionId, setActiveOptionId] = useState(null);
  const [activatedDate, setActivatedDate] = useState(null);
  const [users, setUsers] = useState([]);
  const [availableChecklists, setAvailableChecklists] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(null);
  const [selectedChecklists, setSelectedChecklists] = useState([]);
  const [showSwapModal, setShowSwapModal] = useState(null);
  const [swapDate, setSwapDate] = useState(new Date().toISOString().split('T')[0]);
  const [swapAuditorId, setSwapAuditorId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedOptions, setExpandedOptions] = useState([]);
  const [optionSearch, setOptionSearch] = useState({});

  // Daily Extra Assignment states
  const [showDailyExtra, setShowDailyExtra] = useState(false);
  const [dailyExtraDate, setDailyExtraDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyExtras, setDailyExtras] = useState([]);
  const [dailyExtraChecklist, setDailyExtraChecklist] = useState('');
  const [dailyExtraAuditor, setDailyExtraAuditor] = useState('');
  const [dailyExtraChecklists, setDailyExtraChecklists] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [optRes, userRes] = await Promise.all([
        api.get('/rotation/options'),
        api.get('/rosters/users')
      ]);
      const opts = optRes.data.options || [];
      setOptions(opts);
      setActiveOptionId(optRes.data.active_option_id);
      setActivatedDate(optRes.data.activated_date);
      setUsers(userRes.data.users?.all || []);
      // Restore expanded state from localStorage, or default: first closed, rest open
      const saved = localStorage.getItem('rotationExpandedOptions');
      if (saved) {
        setExpandedOptions(JSON.parse(saved));
      } else {
        setExpandedOptions(opts.slice(1).map(o => o.id));
      }
    } catch {
      showToast('error', 'Failed to load rotation data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableChecklists = async (optionId) => {
    try {
      const res = await api.get(`/rotation/available-checklists?option_id=${optionId}`);
      setAvailableChecklists(res.data.checklists || []);
    } catch {
      showToast('error', 'Failed to load checklists');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/rotation/history');
      setHistory(res.data.history || []);
      setShowHistory(true);
    } catch {
      showToast('error', 'Failed to load history');
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDailyExtras = useCallback(async (date) => {
    try {
      const res = await api.get(`/rotation/daily-extra?date=${date}`);
      setDailyExtras(res.data.extras || []);
    } catch {
      showToast('error', 'Failed to load daily extras');
    }
  }, []);

  const fetchDailyExtraChecklists = async (date) => {
    try {
      const res = await api.get(`/rotation/daily-extra/available-checklists?date=${date || dailyExtraDate}`);
      setDailyExtraChecklists(res.data.checklists || []);
    } catch {
      showToast('error', 'Failed to load checklists');
    }
  };

  const handleOpenDailyExtra = () => {
    setShowDailyExtra(true);
    fetchDailyExtras(dailyExtraDate);
    fetchDailyExtraChecklists(dailyExtraDate);
  };

  const handleCreateDailyExtra = async () => {
    if (!dailyExtraChecklist || !dailyExtraAuditor || !dailyExtraDate) {
      showToast('warning', 'Please select checklist, auditor, and date');
      return;
    }
    try {
      await api.post('/rotation/daily-extra', {
        checklist_id: dailyExtraChecklist,
        auditor_id: dailyExtraAuditor,
        assign_date: dailyExtraDate
      });
      showToast('success', 'Extra assignment created');
      setDailyExtraChecklist('');
      setDailyExtraAuditor('');
      fetchDailyExtras(dailyExtraDate);
      fetchDailyExtraChecklists(dailyExtraDate);
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to create extra assignment');
    }
  };

  const handleDeleteDailyExtra = async (id) => {
    const result = await Swal.fire({
      title: 'Remove Extra Assignment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Remove'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/rotation/daily-extra/${id}`);
      showToast('success', 'Extra assignment removed');
      fetchDailyExtras(dailyExtraDate);
      fetchDailyExtraChecklists(dailyExtraDate);
    } catch {
      showToast('error', 'Failed to delete extra assignment');
    }
  };

  const toggleAccordion = (id) => {
    setExpandedOptions(prev => {
      const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
      localStorage.setItem('rotationExpandedOptions', JSON.stringify(next));
      return next;
    });
  };

  const handleCreateOption = async () => {
    if (!newOptionName.trim()) return;
    try {
      await api.post('/rotation/options', { name: newOptionName.trim() });
      showToast('success', 'Option created successfully');
      setNewOptionName('');
      setShowAddOption(false);
      fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to create option');
    }
  };

  const handleDeleteOption = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Option?',
      text: 'This will remove the option and all its checklist assignments.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/rotation/options/${id}`);
      showToast('success', 'Option deleted');
      fetchData();
    } catch {
      showToast('error', 'Failed to delete option');
    }
  };

  const handleAddChecklists = async (optionId) => {
    if (!selectedChecklists.length) return;
    try {
      await api.post('/rotation/checklists', { option_id: optionId, checklist_ids: selectedChecklists });
      showToast('success', `${selectedChecklists.length} checklist(s) added`);
      setShowAddChecklist(null);
      setSelectedChecklists([]);
      fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to add checklists');
    }
  };

  const handleRemoveChecklist = async (rcId) => {
    const result = await Swal.fire({
      title: 'Remove Checklist?',
      text: 'This checklist will be unlinked from this option.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Remove'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/rotation/checklists/${rcId}`);
      showToast('success', 'Checklist removed');
      fetchData();
    } catch {
      showToast('error', 'Failed to remove checklist');
    }
  };

  const handleAssignAuditor = async (rcId, auditorId) => {
    try {
      await api.put(`/rotation/checklists/${rcId}/assign`, { auditor_id: auditorId || null });
      showToast('success', auditorId ? 'Auditor assigned' : 'Auditor unassigned');
      fetchData();
    } catch {
      showToast('error', 'Failed to assign auditor');
    }
  };

  const handleSwitchOption = async (optionId) => {
    const optName = options.find(o => o.id === optionId)?.name;
    const result = await Swal.fire({
      title: `Activate "${optName}"?`,
      text: 'This will take effect from today. The current active option will be deactivated.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      confirmButtonText: 'Activate'
    });
    if (!result.isConfirmed) return;
    try {
      await api.post('/rotation/switch', { option_id: optionId });
      showToast('success', `Switched to ${optName}`);
      fetchData();
    } catch {
      showToast('error', 'Failed to switch option');
    }
  };

  const handleTempSwap = async () => {
    if (!showSwapModal || !swapAuditorId || !swapDate) {
      showToast('warning', 'Please select auditor and date');
      return;
    }
    try {
      await api.post('/rotation/temp-swap', {
        rotation_checklist_id: showSwapModal.id,
        temp_auditor_id: swapAuditorId,
        swap_date: swapDate
      });
      showToast('success', 'Temp swap created (1 day only)');
      setShowSwapModal(null);
      setSwapAuditorId(null);
      fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to create swap');
    }
  };

  const handleTempUnassign = async () => {
    if (!showSwapModal || !swapDate) return;
    const result = await Swal.fire({
      title: 'Unassign for this day?',
      text: `This checklist won't appear for anyone on ${swapDate}. Next day it will be back to normal.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Unassign'
    });
    if (!result.isConfirmed) return;
    try {
      await api.post('/rotation/temp-unassign', {
        rotation_checklist_id: showSwapModal.id,
        unassign_date: swapDate
      });
      showToast('success', 'Checklist unassigned for the day');
      setShowSwapModal(null);
      setSwapAuditorId(null);
      fetchData();
    } catch (err) {
      showToast('error', err.response?.data?.error || 'Failed to unassign');
    }
  };

  const auditorOptions = users.filter(u => u.role_name === 'Auditor').map(u => ({ value: u.id, label: u.username }));

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <PageHeader title="Rotation Roster">
        <div className="flex items-center space-x-2">
          <button onClick={handleOpenDailyExtra} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Add Today Checklist
          </button>
          <button onClick={fetchHistory} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            Switch History
          </button>
          <button onClick={() => setShowAddOption(true)} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-btn-primary hover:opacity-90">
            + Add Option
          </button>
        </div>
      </PageHeader>

      {/* Active Option Banner */}
      {activeOptionId && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          <span className="text-sm text-green-800 font-medium">
            ● Active: {options.find(o => o.id === activeOptionId)?.name || 'Unknown'}
          </span>
        </div>
      )}

      {/* Options Accordion - Scrollable */}
      <div className="bg-white border border-red-100 rounded-lg flex flex-col flex-1 min-h-0">
        <div className="overflow-auto scroll-container flex-1 min-h-0">
          {options.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No rotation options created yet. Click "+ Add Option" to start.</div>
          ) : (
            options.map(option => {
              const isExpanded = expandedOptions.includes(option.id);
              const isActive = option.id === activeOptionId;
              return (
                <div key={option.id} className={`border-b border-gray-100 last:border-b-0 ${isActive ? 'bg-green-50/30' : ''}`}>
                  {/* Accordion Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                    onClick={() => toggleAccordion(option.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-gray-500" /> : <ChevronRightIcon className="w-4 h-4 text-gray-500" />}
                      <h2 className="text-sm font-semibold text-gray-800">{option.name}</h2>
                      {isActive && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Active</span>
                      )}
                      <span className="text-xs text-gray-400">({(option.checklists || []).length} checklists, {(option.checklists || []).filter(c => c.auditor_id).length} assigned)</span>
                    </div>
                    <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={optionSearch[option.id] || ''}
                        onChange={(e) => setOptionSearch(prev => ({ ...prev, [option.id]: e.target.value }))}
                        placeholder="Search by checklist, location, auditor..."
                        className="w-56 px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300"
                      />
                      {!isActive && (
                        <button onClick={() => handleSwitchOption(option.id)} className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700">
                          Activate
                        </button>
                      )}
                      <button onClick={() => { setShowAddChecklist(option.id); fetchAvailableChecklists(option.id); }} className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100">
                        + Checklist
                      </button>
                      {/* <button onClick={() => handleDeleteOption(option.id)} className="px-3 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">
                        Delete
                      </button> */}
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <table className="min-w-full">
                        <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700">Checklist</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700">Location</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700">Department</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700">Assigned Auditor</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(() => {
                            const search = (optionSearch[option.id] || '').toLowerCase();
                            const filtered = (option.checklists || []).filter(rc =>
                              !search ||
                              rc.checklist_name?.toLowerCase().includes(search) ||
                              rc.location_name?.toLowerCase().includes(search) ||
                              rc.department_name?.toLowerCase().includes(search) ||
                              rc.auditor_name?.toLowerCase().includes(search) ||
                              rc.effective_auditor_name?.toLowerCase().includes(search)
                            );
                            return filtered.length === 0 ? (
                            <tr><td colSpan="5" className="px-4 py-4 text-center text-sm text-gray-400">No checklists found</td></tr>
                          ) : (
                            filtered.map((rc, idx) => (
                              <tr key={rc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{rc.checklist_name}</td>
                                <td className="px-4 py-2.5 text-sm text-gray-600">{rc.location_name || '-'}</td>
                                <td className="px-4 py-2.5 text-sm text-gray-600">{rc.department_name || '-'}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="min-w-[200px]">
                                      <SearchableSelect
                                        options={[{ value: '', label: 'Unassigned' }, ...auditorOptions]}
                                        value={rc.auditor_id || ''}
                                        onChange={(val) => handleAssignAuditor(rc.id, val)}
                                        placeholder="Select Auditor"
                                      />
                                    </div>
                                    {rc.is_temp_swap && (
                                      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full font-medium whitespace-nowrap" title={`Temp: ${rc.effective_auditor_name}`}>
                                        ↔ {rc.effective_auditor_name}
                                      </span>
                                    )}
                                    {rc.is_temp_unassigned && (
                                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium whitespace-nowrap">
                                        ✕ Unassigned today
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex gap-1">
                                    {isActive && (
                                      <button onClick={() => setShowSwapModal(rc)} className="px-2 py-1 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded hover:bg-yellow-100">
                                        Temp Swap
                                      </button>
                                    )}

                                  </div>
                                </td>
                              </tr>
                            ))
                          );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Option Modal */}
      {showAddOption && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Create New Option</h3>
            <input
              type="text"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateOption()}
              placeholder="Option name (e.g. Option A)"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowAddOption(false); setNewOptionName(''); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreateOption} className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-md hover:opacity-90">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Checklist Modal */}
      {showAddChecklist && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add Checklists to Option</h3>
            <SearchableMultiSelect
              options={availableChecklists.map(c => ({ value: c.id, label: `${c.checklist_name} (${c.location_name || ''})` }))}
              value={selectedChecklists}
              onChange={setSelectedChecklists}
              placeholder="Search and select checklists..."
            />
            {selectedChecklists.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">{selectedChecklists.length} checklist(s) selected</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowAddChecklist(null); setSelectedChecklists([]); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleAddChecklists(showAddChecklist)} disabled={!selectedChecklists.length} className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                Add ({selectedChecklists.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp Swap Modal */}
      {showSwapModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onKeyDown={(e) => e.key === 'Escape' && (setShowSwapModal(null), setSwapAuditorId(null))}
          tabIndex={-1}
          ref={(el) => el && el.focus()}
        >
          <div className="bg-white rounded-xl w-[420px] shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Temporary Swap</h3>
                  <p className="text-red-100 text-xs mt-0.5">This swap applies for 1 day only</p>
                </div>
                <button onClick={() => { setShowSwapModal(null); setSwapAuditorId(null); }} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-visible">
              {/* Checklist Info */}
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                <p className="text-xs text-gray-500">Checklist</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{showSwapModal.checklist_name}</p>
                {showSwapModal.effective_auditor_name && (
                  <p className="text-xs text-gray-500 mt-1">
                    Current Auditor: <span className="text-gray-700 font-medium">{showSwapModal.effective_auditor_name}</span>
                    {showSwapModal.is_temp_swap && <span className="text-yellow-600 ml-1">(temp swap today)</span>}
                  </p>
                )}
                {!showSwapModal.is_temp_swap && showSwapModal.auditor_name && (
                  <p className="text-xs text-gray-500 mt-1">Permanent Auditor: <span className="text-gray-700 font-medium">{showSwapModal.auditor_name}</span></p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Swap Date</label>
                <input
                  type="date"
                  value={swapDate}
                  onChange={(e) => setSwapDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Auditor */}
              <div className="relative">
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Assign Temporary Auditor</label>
                <SearchableSelect
                  options={auditorOptions}
                  value={swapAuditorId}
                  onChange={setSwapAuditorId}
                  placeholder="Search auditor..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between rounded-b-xl">
              <button onClick={handleTempUnassign} disabled={!swapDate} className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Unassign for this day</button>
              <div className="flex gap-2">
                <button onClick={() => { setShowSwapModal(null); setSwapAuditorId(null); }} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors">Cancel</button>
                <button onClick={handleTempSwap} disabled={!swapAuditorId || !swapDate} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Confirm Swap</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Extra Modal */}
      {showDailyExtra && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[600px] shadow-2xl flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Daily Extra Checklist Assignment</h3>
                <p className="text-red-100 text-xs mt-0.5">One-day-only assignments outside the rotation</p>
              </div>
              <button onClick={() => setShowDailyExtra(false)} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-auto flex-1">
              {/* Date picker */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Date</label>
                <input
                  type="date"
                  value={dailyExtraDate}
                  onChange={(e) => { setDailyExtraDate(e.target.value); fetchDailyExtras(e.target.value); fetchDailyExtraChecklists(e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Add new extra */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-3">
                <p className="text-xs font-medium text-gray-700">Add New Assignment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SearchableSelect
                      options={dailyExtraChecklists.map(c => ({ value: c.id, label: `${c.checklist_name} (${c.location_name || ''})` }))}
                      value={dailyExtraChecklist}
                      onChange={setDailyExtraChecklist}
                      placeholder="Select Checklist"
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      options={auditorOptions}
                      value={dailyExtraAuditor}
                      onChange={setDailyExtraAuditor}
                      placeholder="Select Auditor"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateDailyExtra}
                  disabled={!dailyExtraChecklist || !dailyExtraAuditor}
                  className="px-4 py-2 text-sm font-medium text-white bg-btn-primary rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Assign
                </button>
              </div>

              {/* Existing extras for selected date */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Assignments for {dailyExtraDate}</p>
                <table className="min-w-full text-sm">
                  <thead style={{ backgroundColor: '#ededed' }}>
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Checklist</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Auditor</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dailyExtras.length === 0 ? (
                      <tr><td colSpan="3" className="px-3 py-4 text-center text-gray-400">No extra assignments for this date</td></tr>
                    ) : (
                      dailyExtras.map(ex => (
                        <tr key={ex.id}>
                          <td className="px-3 py-2">{ex.checklist_name} {ex.location_name ? `(${ex.location_name})` : ''}</td>
                          <td className="px-3 py-2">{ex.auditor_name}</td>
                          <td className="px-3 py-2">
                            <button onClick={() => handleDeleteDailyExtra(ex.id)} className="px-2 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100">
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-xl">
              <button onClick={() => setShowDailyExtra(false)} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[500px] max-h-[70vh] shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Switch History</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="min-w-full text-sm">
                <thead style={{ backgroundColor: '#ededed' }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Option</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Activated Date</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map(h => (
                    <tr key={h.id}>
                      <td className="px-3 py-2">{h.option_name}</td>
                      <td className="px-3 py-2">{h.activated_date}</td>
                      <td className="px-3 py-2">{h.activated_by_name}</td>
                    </tr>
                  ))}
                  {history.length === 0 && <tr><td colSpan="3" className="px-3 py-6 text-center text-gray-400">No switch history yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotationRoster;
