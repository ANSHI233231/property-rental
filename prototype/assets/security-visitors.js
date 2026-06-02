/* ============================================================================
 * security-visitors.js — single source of truth for the Security (gate) portal.
 * Both security/dashboard.html (KPIs + awaiting list) and security/visitors.html
 * (gate log table) render from this one array so their numbers never diverge.
 *
 * status: 'awaiting' (gate request routed to tenant) | 'pending' (pre-approved,
 *   tenant hasn't acted) | 'approved' | 'checked-in' | 'checked-out' | 'denied'
 * type:   'gate' (walk-in logged at the gate) | 'preapproved'
 * Numeric/stable ids per CLAUDE.md rule #19 (rowId is a stable string handle).
 * ========================================================================== */
(function (global) {
  'use strict';

  var PROPERTY_LABEL = {
    'green-valley': 'Green Valley, Dwarka',
    'sai-heights': 'Sai Heights, Lajpat Nagar',
    'mayur-vihar': 'Mayur Vihar Residency'
  };

  // Canonical gate log (order = newest activity first as shown in the table).
  var SEC_VISITORS = [
    { rowId: 'G1', name: 'Imran Sheikh',   type: 'gate',        phone: '98220 11334', purpose: 'Delivery — Amazon',   property: 'green-valley', unit: '3A', tenant: 'Raj Sharma',    when: 'Now · at gate',                       status: 'awaiting',    code: '' },
    { rowId: 'G2', name: 'Sana Khan',      type: 'gate',        phone: '98300 55221', purpose: 'Guest',               property: 'green-valley', unit: '1B', tenant: 'Aditi Rao',     when: 'Now · at gate',                       status: 'approved',    code: '' },
    { rowId: '1',  name: 'Rohan Mehta',    type: 'preapproved', phone: '98765 43210', purpose: 'Personal visit',      property: 'green-valley', unit: '3A', tenant: 'Raj Sharma',    when: 'Expected 27/05/2026 14:00',           status: 'pending',     code: 'VIS-B3M9' },
    { rowId: '2',  name: 'Priya Kapoor',   type: 'preapproved', phone: '91234 56789', purpose: 'Delivery',            property: 'green-valley', unit: '2A', tenant: 'Priya Patel',   when: 'Expected 26/05/2026 11:00',           status: 'pending',     code: 'VIS-C5N1' },
    { rowId: '3',  name: 'Arjun Verma',    type: 'preapproved', phone: '87654 32109', purpose: 'Maintenance vendor',  property: 'mayur-vihar',  unit: '5B', tenant: 'Vikram Singh',  when: 'Expected 26/05/2026 15:00',           status: 'pending',     code: 'VIS-D8P4' },
    { rowId: 'A',  name: 'Kavya Sharma',   type: 'preapproved', phone: '96543 21098', purpose: 'Personal visit',      property: 'green-valley', unit: '3A', tenant: 'Raj Sharma',    when: 'Expected 26/05/2026 16:00',           status: 'approved',    code: 'VIS-A7K2' },
    { rowId: 'B',  name: 'Deepak Joshi',   type: 'preapproved', phone: '93210 98765', purpose: 'Service / Utility',   property: 'mayur-vihar',  unit: '5B', tenant: 'Vikram Singh',  when: 'Expected 27/05/2026 10:00',           status: 'approved',    code: 'VIS-E2Q6' },
    { rowId: 'X',  name: 'Meena Rao',      type: 'preapproved', phone: '91111 22222', purpose: 'Personal visit',      property: 'green-valley', unit: '2A', tenant: 'Priya Patel',   when: 'Arrived 26/05/2026 09:42',            status: 'checked-in',  code: 'VIS-F1X8' },
    { rowId: 'C1', name: 'Suresh Nair',    type: 'preapproved', phone: '90000 11111', purpose: 'Personal visit',      property: 'green-valley', unit: '3A', tenant: 'Raj Sharma',    when: 'Departed 24/05/2026 16:30 · 2h 30m',  status: 'checked-out', code: 'VIS-G2Y9' },
    { rowId: 'C2', name: 'Ananya Gupta',   type: 'preapproved', phone: '92222 33333', purpose: 'Cab / Ride pickup',   property: 'mayur-vihar',  unit: '5B', tenant: 'Vikram Singh',  when: 'Departed 23/05/2026 13:00 · 1h 45m',  status: 'checked-out', code: 'VIS-H3Z1' },
    { rowId: 'C3', name: 'Ravi Kumar',     type: 'preapproved', phone: '93333 44444', purpose: 'Delivery',            property: 'green-valley', unit: '2A', tenant: 'Priya Patel',   when: 'Departed 21/05/2026 19:45 · 2h 45m',  status: 'checked-out', code: 'VIS-J4W2' },
    { rowId: 'D1', name: 'Unknown Vendor', type: 'preapproved', phone: '88888 77777', purpose: 'Maintenance vendor',  property: 'green-valley', unit: '3A', tenant: 'Raj Sharma',    when: 'Expected 20/05/2026 10:00',           status: 'denied',      code: 'VIS-K5V3' }
  ];

  function propertyLabel(slug) { return PROPERTY_LABEL[slug] || slug; }

  // Counts used by the dashboard tiles + the visitors filter tiles.
  function summary() {
    var s = { total: 0, awaiting: 0, pending: 0, approved: 0, checkedIn: 0, checkedOut: 0, denied: 0 };
    SEC_VISITORS.forEach(function (v) {
      s.total++;
      if (v.status === 'awaiting') s.awaiting++;
      else if (v.status === 'pending') s.pending++;
      else if (v.status === 'approved') s.approved++;
      else if (v.status === 'checked-in') s.checkedIn++;
      else if (v.status === 'checked-out') s.checkedOut++;
      else if (v.status === 'denied') s.denied++;
    });
    return s;
  }

  function byStatus(status) { return SEC_VISITORS.filter(function (v) { return v.status === status; }); }

  global.SecurityVisitors = {
    LIST: SEC_VISITORS,
    PROPERTY_LABEL: PROPERTY_LABEL,
    propertyLabel: propertyLabel,
    summary: summary,
    byStatus: byStatus
  };
})(typeof window !== 'undefined' ? window : this);
