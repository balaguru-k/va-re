import React, { useState, useEffect } from 'react';
import PageHeader from '../components/UI/PageHeader';
import MultiSelectDropdown from '../components/UI/MultiSelectDropdown';
import showToast from '../utils/toast';
import api from '../services/api';
import { rosterAPI } from '../services/api';
import useApi from '../hooks/useApi';
import XLSX from 'xlsx-js-style';

const formatTime = (seconds) => {
  if (!seconds) return '00:00:00';
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formatDateDisplay = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const VAReport = () => {
  const today = new Date().toISOString().split('T')[0];
  const { loading: apiLoading, execute } = useApi();
  const [loading, setLoading] = useState(false);
  const [auditors, setAuditors] = useState([]);
  const [auditorReports, setAuditorReports] = useState([]);
  const [dateColumns, setDateColumns] = useState([]);
  const [filters, setFilters] = useState({
    fromDate: today,
    toDate: today,
    auditorIds: []
  });

  useEffect(() => {
    fetchUsers();
  }, []);


  const fetchUsers = async () => {
    await execute(
      () => rosterAPI.getUsers(),
      {
        onSuccess: (response) => setAuditors(response.data.users?.auditors || []),
        errorMessage: 'Unable to load auditors. Please try again.',
        showLoading: false
      }
    );
  };

  const fetchReport = async (overrideFilters) => {
    const f = (overrideFilters && overrideFilters.fromDate) ? overrideFilters : filters;
    if (f.toDate < f.fromDate) {
      showToast('error', 'To date cannot be earlier than from date');
      return;
    }
    try {
      setLoading(true);
      const params = { fromDate: f.fromDate, toDate: f.toDate };
      if (f.auditorIds?.length > 0) params.auditorIds = f.auditorIds.join(',');
      const res = await api.get('/reports/va-report', { params });
      setAuditorReports(res.data.auditorReports || []);
      setDateColumns(res.data.dateColumns || []);
    } catch {
      showToast('error', 'Failed to load VA report');
    } finally {
      setLoading(false);
    }
  };

  const rows = [
    { key: 'totalTime', label: 'Total time spent on Audit', format: formatTime },
    { key: 'completedCount', label: 'Number of Checklist Completed' },
    { key: 'totalLines', label: 'Number of lines audited' },
    { key: 'totalNCs', label: "NC's raised" },
    { key: 'total_camera_count', label: "Total Camera Count" },
    { key: 'total_camera_audited', label: "Total Camera Audited"},
    { key: 'total_camera_not_audited', label: "Total Camera Not Audited" },
    { key: 'totalOffline', label: 'No of Camera Offline' },
    { key: 'totalTechnical', label: 'Technical Issue' },
    { key: 'totalPending', label: 'NC Pending for Action' },
    { key: 'expired', label: 'VA Audit Expired Checklist' }
  ];

  const getTotal = (data, key, format) => {
    const sum = dateColumns.reduce((s, d) => s + (data[d]?.[key] || 0), 0);
    return format ? format(sum) : sum;
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const aoa = [];

    // Header row: Auditor | Date | metrics...
    const headerRow = ['Auditor', 'Date', ...rows.map(r => r.label)];
    aoa.push(headerRow);

    // Group by date: all auditors for date1, then all auditors for date2, etc.
    dateColumns.forEach(date => {
      auditorReports.forEach(auditor => {
        const dataRow = [auditor.auditor_name, formatDateDisplay(date)];
        rows.forEach(row => {
          const val = auditor.data[date]?.[row.key] || 0;
          dataRow.push(row.format ? row.format(val) : val);
        });
        aoa.push(dataRow);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Column widths
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, ...rows.map(() => ({ wch: 22 }))];

    // Style header row
    const headerStyle = {
      fill: { fgColor: { rgb: '0070C0' } },
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
    headerRow.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) ws[addr] = { v: headerRow[c], t: 's' };
      ws[addr].s = headerStyle;
    });

    XLSX.utils.book_append_sheet(wb, ws, 'VA Report');
    XLSX.writeFile(wb, `VA_Report_${filters.fromDate}_to_${filters.toDate}.xlsx`, { cellStyles: true });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Virtual Auditor Report">
      </PageHeader>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input type="date" value={filters.fromDate} max={filters.toDate || undefined} onChange={(e) => setFilters(p => ({ ...p, fromDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input type="date" value={filters.toDate} min={filters.fromDate || undefined} onChange={(e) => setFilters(p => ({ ...p, toDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auditor</label>
            <MultiSelectDropdown
              options={auditors.map(a => ({ value: a.id, label: a.username }))}
              selected={filters.auditorIds}
              onChange={(val) => setFilters(p => ({ ...p, auditorIds: val }))}
              placeholder="All Auditors"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button onClick={fetchReport} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">
              Filter
            </button>
            <button onClick={() => { setFilters({ fromDate: today, toDate: today, auditorIds: [] }); fetchReport({ fromDate: today, toDate: today, auditorIds: [] }); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300">
              Reset
            </button>
            {auditorReports.length > 0 && (
              <button onClick={exportExcel} className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300">
                Export
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : auditorReports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No data found for the selected filters</div>
          ) : (
            <div className="space-y-6 p-4">
              {auditorReports.map((auditor) => (
                <div key={auditor.auditor_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-800">{auditor.auditor_name}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead style={{ backgroundColor: '#ededed' }} className="border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 sticky left-0 bg-[#ededed] z-10" style={{ minWidth: '250px' }}>Title</th>
                          {dateColumns.map(d => (
                            <th key={d} className="px-4 py-3 text-center text-sm font-medium text-gray-700 whitespace-nowrap">{formatDateDisplay(d)}</th>
                          ))}
                          <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 bg-gray-200">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((row, idx) => (
                          <tr key={row.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb' }}>{row.label}</td>
                            {dateColumns.map(d => (
                              <td key={d} className="px-4 py-3 text-sm text-gray-900 text-center">
                                {row.format ? row.format(auditor.data[d]?.[row.key] || 0) : (auditor.data[d]?.[row.key] || 0)}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-center bg-gray-100">
                              {getTotal(auditor.data, row.key, row.format)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VAReport;
