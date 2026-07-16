const STATUS_ORDER = { 'Completed': 0, 'Duplicate': 0, 'Ticket by mistake': 0, 'Raised': 1, 'In Progress': 2, 'Pending': 3, 'New': 4 };

export const getEffectiveStatus = (t) => t.vendor_status || t.engineer_status || t.status || 'New';

export const sortTickets = (tickets, sortKey, sortDir) => {
  if (!sortKey) return tickets;
  return [...tickets].sort((a, b) => {
    if (sortKey === 'status' || sortKey === 'vendor_status' || sortKey === 'engineer_status') {
      const sa = STATUS_ORDER[getEffectiveStatus(a)] ?? 5;
      const sb = STATUS_ORDER[getEffectiveStatus(b)] ?? 5;
      return sortDir === 'asc' ? sa - sb : sb - sa;
    }
    let av = a[sortKey] ?? '';
    let bv = b[sortKey] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
};
