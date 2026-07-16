import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import PageHeader from '../components/UI/PageHeader';
import toast from 'react-hot-toast';

const issueOptions = [
  'Online', 'Slow streaming', 'No video', 'Offline', 'Sensor issue',
  'Streaming not ready', 'Timing mismatch', 'Playback issue', 'Camera offline goes offline often'
];

const ComplianceTicketEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState(null);

  // Pending / Completed
  const [remarksText, setRemarksText] = useState('');

  // Raise Ticket
  const [vendors, setVendors] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [raiseForm, setRaiseForm] = useState({
    subject: '',
    user_assign_date: '',
    assigned_vendors: '',
    assigned_engineers: '',
    interested_party: [],
    remarks: '',
    attachments: []
  });
  const [raiseErrors, setRaiseErrors] = useState({});
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (activeAction === 'Raise') {
      api.get('/tickets/raise/users')
        .then(res => {
          setVendors(res.data.data?.vendors || []);
          setEngineers(res.data.data?.engineers || []);
          setAllUsers(res.data.data?.allUsers || []);
        })
        .catch(() => toast.error('Failed to load vendors/engineers'));
    }
  }, [activeAction]);

  const toggleAction = (key) => {
    setActiveAction(prev => prev === key ? null : key);
    setRemarksText('');
    setRaiseForm({ subject: '', user_assign_date: '', assigned_vendors: '', assigned_engineers: '', interested_party: [], remarks: '', attachments: [] });
    setRaiseErrors({});
  };

  const handleStatusSubmit = async () => {
    if (!remarksText.trim()) { toast.error('Remarks are required'); return; }
    setSubmitting(true);
    try {
      await api.patch(`/tickets/${id}/status`, { status: activeAction, status_remarks: remarksText });
      toast.success(`Ticket marked as ${activeAction}`);
      navigate('/compliance/dashboard');
    } catch {
      toast.error('Failed to update status');
    } finally { setSubmitting(false); }
  };

  const handleRaiseFiles = (files) => {
    const validFiles = Array.from(files);
    setRaiseForm(p => ({ ...p, attachments: [...p.attachments, ...validFiles] }));
  };

  const removeRaiseFile = (index) => {
    setRaiseForm(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== index) }));
  };

  const toggleMultiSelect = (field, value) => {
    setRaiseForm(p => ({
      ...p,
      [field]: p[field].includes(value) ? p[field].filter(v => v !== value) : [...p[field], value]
    }));
  };

  const validateRaiseForm = () => {
    const errors = {};
    if (!raiseForm.subject.trim()) errors.subject = 'Subject is required';
    
    const hasVendor = !!raiseForm.assigned_vendors;
    const hasEngineer = !!raiseForm.assigned_engineers;
    
    if (!hasVendor && !hasEngineer) {
      errors.assigned_vendors = 'Select vendor or engineer';
      errors.assigned_engineers = 'Select vendor or engineer';
    } else if (hasVendor && hasEngineer) {
      errors.assigned_vendors = 'Select only one';
      errors.assigned_engineers = 'Select only one';
    }
    
    setRaiseErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRaiseSave = async (isDraft) => {
    if (!isDraft && !validateRaiseForm()) return;
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('subject', raiseForm.subject);
      data.append('user_assign_date', raiseForm.user_assign_date);
      data.append('assigned_vendors', raiseForm.assigned_vendors || '');
      data.append('assigned_engineers', raiseForm.assigned_engineers || '');
      data.append('interested_party', JSON.stringify(raiseForm.interested_party));
      data.append('status_remarks', raiseForm.remarks);
      data.append('is_draft', isDraft ? 'true' : 'false');
      raiseForm.attachments.forEach(f => data.append('raise_attachments', f));

      await api.patch(`/tickets/${id}/raise`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(isDraft ? 'Draft saved' : 'Ticket raised successfully');
      navigate('/compliance/dashboard');
    } catch {
      toast.error('Failed to save raise ticket');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Ticket Actions">
        <button onClick={() => navigate('/compliance/dashboard')}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          ← Back
        </button>
      </PageHeader>

      <div className="bg-white border border-red-100 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: '#ededed' }}>
          <span className="text-sm font-medium text-gray-700">Actions</span>
        </div>
        <div className="p-4 flex gap-3">
          {[
            { key: 'Pending',   label: 'Pending',      cls: 'border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100', active: 'border-yellow-500 bg-yellow-400 text-white' },
            { key: 'Completed', label: 'Completed',    cls: 'border-green-400 bg-green-50 text-green-700 hover:bg-green-100',     active: 'border-green-500 bg-green-500 text-white' },
            { key: 'Raise',     label: 'Raise Ticket', cls: 'border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100',         active: 'border-blue-500 bg-blue-500 text-white' },
          ].map(btn => (
            <button key={btn.key} onClick={() => toggleAction(btn.key)}
              className={`px-4 py-2 text-sm font-medium border-2 rounded-lg transition-colors ${activeAction === btn.key ? btn.active : btn.cls}`}>
              {btn.label}
            </button>
          ))}
        </div>

        {/* Pending / Completed */}
        {activeAction && activeAction !== 'Raise' && (
          <div className="px-4 pb-4">
            <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">{activeAction}</span>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Remarks <span className="text-red-500">*</span></label>
                  <textarea value={remarksText} onChange={e => setRemarksText(e.target.value)} rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter remarks for marking as ${activeAction}...`} />
                </div>
                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setActiveAction(null)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={handleStatusSubmit} disabled={submitting}
                    className={`px-6 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${activeAction === 'Completed' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'}`}>
                    {submitting ? 'Saving...' : `Confirm ${activeAction}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Raise Ticket Form */}
        {activeAction === 'Raise' && (
          <div className="px-4 pb-4">
            <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm mt-2">
              <div className="px-5 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-800">Raise Ticket</span>
              </div>
              <div className="px-5 py-4 space-y-6">

                {/* Row 1: Ticket ID + Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ticket ID</label>
                    <input type="text" value={`#${id}`} readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                    <input type="date" value={raiseForm.user_assign_date} onChange={e => setRaiseForm(p => ({ ...p, user_assign_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject <span className="text-red-500">*</span></label>
                  <input type="text" value={raiseForm.subject} onChange={e => { setRaiseForm(p => ({ ...p, subject: e.target.value })); setRaiseErrors(p => ({ ...p, subject: '' })); }}
                    placeholder="Enter subject"
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.subject ? 'border-red-500' : 'border-gray-300'}`} />
                  {raiseErrors.subject && <p className="text-red-500 text-xs mt-1">{raiseErrors.subject}</p>}
                </div>

                {/* Row 2: Vendor + Engineer dropdowns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Choose Vendor <span className="text-red-500">*</span></label>
                    <select value={raiseForm.assigned_vendors} onChange={e => { setRaiseForm(p => ({ ...p, assigned_vendors: e.target.value })); setRaiseErrors(p => ({ ...p, assigned_vendors: '', assigned_engineers: '' })); }}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.assigned_vendors ? 'border-red-500' : 'border-gray-300'}`}>
                      <option value="">Select vendor...</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                    {raiseErrors.assigned_vendors && <p className="text-red-500 text-xs mt-1">{raiseErrors.assigned_vendors}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Choose Engineer <span className="text-red-500">*</span></label>
                    <select value={raiseForm.assigned_engineers} onChange={e => { setRaiseForm(p => ({ ...p, assigned_engineers: e.target.value })); setRaiseErrors(p => ({ ...p, assigned_vendors: '', assigned_engineers: '' })); }}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${raiseErrors.assigned_engineers ? 'border-red-500' : 'border-gray-300'}`}>
                      <option value="">Select engineer...</option>
                      {engineers.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                    {raiseErrors.assigned_engineers && <p className="text-red-500 text-xs mt-1">{raiseErrors.assigned_engineers}</p>}
                  </div>
                </div>

                {/* Interested Party */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Choose Interested Party</label>
                  <select onChange={e => { if (e.target.value) toggleMultiSelect('interested_party', Number(e.target.value)); e.target.value = ''; }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select user...</option>
                    {allUsers.filter(u => !raiseForm.interested_party.includes(u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                  {raiseForm.interested_party.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {raiseForm.interested_party.map(uid => {
                        const u = allUsers.find(x => x.id === uid);
                        return u ? (
                          <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {u.name}
                            <button type="button" onClick={() => toggleMultiSelect('interested_party', uid)} className="hover:text-purple-900">×</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                  <textarea value={raiseForm.remarks} onChange={e => setRaiseForm(p => ({ ...p, remarks: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter remarks..." />
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Attachments</label>
                  <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${raiseErrors.attachments ? 'border-red-500' : dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleRaiseFiles(e.dataTransfer.files); setRaiseErrors(p => ({ ...p, attachments: '' })); }}
                    onClick={() => document.getElementById('raise-file').click()}>
                    {raiseForm.attachments.length > 0 ? (
                      <div className="flex gap-2 flex-wrap justify-center">
                        {raiseForm.attachments.map((f, i) => (
                          <div key={i} className="relative">
                            {f.type.startsWith('image/') ? (
                              <img src={URL.createObjectURL(f)} alt={`p-${i}`} className="w-16 h-16 object-cover rounded border" />
                            ) : (
                              <div className="w-16 h-16 flex flex-col items-center justify-center border rounded bg-gray-50 text-xs text-gray-600 p-1">
                                <span className="truncate w-full text-center">{f.name.split('.').pop().toUpperCase()}</span>
                              </div>
                            )}
                            <button type="button" onClick={(e) => { e.stopPropagation(); removeRaiseFile(i); }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <CloudArrowUpIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-500">Drag & drop files here, or click to browse</p>
                      </div>
                    )}
                    <input id="raise-file" type="file" multiple className="hidden"
                      onChange={e => { handleRaiseFiles(e.target.files); setRaiseErrors(p => ({ ...p, attachments: '' })); }} />
                  </div>
                  {raiseErrors.attachments && <p className="text-red-500 text-xs mt-1">{raiseErrors.attachments}</p>}
                </div>

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setActiveAction(null)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button onClick={() => handleRaiseSave(true)} disabled={submitting}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-400 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button onClick={() => handleRaiseSave(false)} disabled={submitting}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                    {submitting ? 'Sending...' : 'Send Raise Ticket'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplianceTicketEdit;
