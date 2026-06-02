/* ============================================================================
 * rent-data.js — canonical lease + payment roster for the rent-collection
 * prototype. Single source consumed by admin / PM / tenant rent pages so all
 * surfaces stay mutually consistent. Status/fees are NEVER stored here — they
 * are computed by rent-engine.js at read time.
 *
 * Worked-example "today" = 2026-06-02 (see RentEngine.TODAY_MS).
 * Every relation references the target's numeric id only (CLAUDE.md rule #19).
 * Two lease types — 'unit' (whole unit) and 'room' (per-room) — differ only as
 * a label addon; rent collection treats them identically.
 * ========================================================================== */
(function (global) {
  'use strict';

  // Properties (id → name) and their managing PM, for scope + display.
  var PROPERTIES = [
    { id: 1, name: 'Green Valley', pmName: 'Sunita Arora' },
    { id: 2, name: 'Sai Heights', pmName: 'Manoj Verma' },
    { id: 3, name: 'Rohini Greens', pmName: 'Anil Kapoor' },
    { id: 4, name: 'Mayur Vihar Apartments', pmName: 'Pooja Khanna' }
  ];

  // helper to keep the literal terse
  function pay(id, parentId, y, m, amount, lateFee, date, method, ref) {
    return { id: id, parentId: parentId, periodYear: y, periodMonth: m, amount: amount, lateFee: lateFee, paymentDate: date, methodName: method, reference: ref || '' };
  }

  var RENT_LEASES = [
    // 1 — heavy arrears (Mar–Jun unpaid) → Overdue. Co-tenant lease. Allocator demo.
    {
      id: 1, leaseCode: '#LM-0001', tenantId: 1, tenantName: 'Raj Sharma',
      coTenants: [{ id: 2, name: 'Priya Sharma' }],
      propertyId: 1, propertyName: 'Green Valley', unitId: 301, unitLabel: 'Unit 3A',
      pmName: 'Sunita Arora', leaseType: 'unit', roomLabel: '',
      rentAmount: 18000, depositAmount: 36000, rentDueDay: 1,
      startDate: '01/01/2026', endDate: '31/12/2026', status: 'Active',
      rentChanges: [],
      payments: [
        pay(101, null, 2026, 1, 18000, 0, '03/01/2026', 'UPI', '412345678901'),
        pay(102, null, 2026, 2, 18000, 0, '05/02/2026', 'UPI', '998877665544')
      ]
    },
    // 2 — fully current → Paid.
    {
      id: 2, leaseCode: '#LM-0002', tenantId: 3, tenantName: 'Vikram Mehta',
      coTenants: [],
      propertyId: 1, propertyName: 'Green Valley', unitId: 201, unitLabel: 'Unit 2B',
      pmName: 'Sunita Arora', leaseType: 'unit', roomLabel: '',
      rentAmount: 24000, depositAmount: 48000, rentDueDay: 1,
      startDate: '01/03/2026', endDate: '28/02/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(110, null, 2026, 3, 24000, 0, '02/03/2026', 'Bank Transfer', 'NEFT-3001'),
        pay(111, null, 2026, 4, 24000, 0, '01/04/2026', 'UPI', '887766554433'),
        pay(112, null, 2026, 5, 24000, 0, '03/05/2026', 'UPI', '776655443322'),
        pay(113, null, 2026, 6, 24000, 0, '01/06/2026', 'UPI', '665544332211')
      ]
    },
    // 3 — May partial + overdue → Partial Overdue. Due day 5.
    {
      id: 3, leaseCode: '#LM-0003', tenantId: 4, tenantName: 'Anjali Verma',
      coTenants: [],
      propertyId: 2, propertyName: 'Sai Heights', unitId: 402, unitLabel: 'Unit 4B',
      pmName: 'Manoj Verma', leaseType: 'unit', roomLabel: '',
      rentAmount: 32000, depositAmount: 64000, rentDueDay: 5,
      startDate: '01/02/2026', endDate: '31/01/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(120, null, 2026, 2, 32000, 0, '05/02/2026', 'Bank Transfer', 'NEFT-1123'),
        pay(121, null, 2026, 3, 32000, 0, '04/03/2026', 'Bank Transfer', 'NEFT-1190'),
        pay(122, null, 2026, 4, 32000, 0, '06/04/2026', 'UPI', '554433221100'),
        pay(123, null, 2026, 5, 12000, 0, '08/05/2026', 'Cash', '')
      ]
    },
    // 4 — Mar–Jun unpaid → Overdue (heavy arrears).
    {
      id: 4, leaseCode: '#LM-0004', tenantId: 5, tenantName: 'Aman Khan',
      coTenants: [],
      propertyId: 3, propertyName: 'Rohini Greens', unitId: 101, unitLabel: 'Unit 1C',
      pmName: 'Anil Kapoor', leaseType: 'unit', roomLabel: '',
      rentAmount: 26000, depositAmount: 52000, rentDueDay: 1,
      startDate: '01/02/2026', endDate: '31/01/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(130, null, 2026, 2, 26000, 0, '07/02/2026', 'UPI', '443322110099')
      ]
    },
    // 5 — ROOM-WISE. May+Jun unpaid → Overdue.
    {
      id: 5, leaseCode: '#LM-0005', tenantId: 6, tenantName: 'Akash Joshi',
      coTenants: [],
      propertyId: 4, propertyName: 'Mayur Vihar Apartments', unitId: 502, unitLabel: 'Unit 5B',
      pmName: 'Pooja Khanna', leaseType: 'room', roomLabel: 'Room B',
      rentAmount: 6500, depositAmount: 13000, rentDueDay: 1,
      startDate: '01/03/2026', endDate: '28/02/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(140, null, 2026, 3, 6500, 0, '05/03/2026', 'Cash', ''),
        pay(141, null, 2026, 4, 6500, 0, '05/04/2026', 'Cash', '')
      ]
    },
    // 6 — paid Jun + Jul advance (one transaction) → Prepaid.
    {
      id: 6, leaseCode: '#LM-0006', tenantId: 7, tenantName: 'Neha Gupta',
      coTenants: [],
      propertyId: 1, propertyName: 'Green Valley', unitId: 101, unitLabel: 'Unit 1A',
      pmName: 'Sunita Arora', leaseType: 'unit', roomLabel: '',
      rentAmount: 20000, depositAmount: 40000, rentDueDay: 1,
      startDate: '01/04/2026', endDate: '31/03/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(150, null, 2026, 4, 20000, 0, '01/04/2026', 'UPI', '120120120120'),
        pay(151, null, 2026, 5, 20000, 0, '01/05/2026', 'UPI', '130130130130'),
        pay(160, null, 2026, 6, 20000, 0, '28/05/2026', 'Bank Transfer', 'NEFT-6006'),
        pay(161, 160, 2026, 7, 20000, 0, '28/05/2026', 'Bank Transfer', 'NEFT-6006')
      ]
    },
    // 7 — only current month (Jun) due, no arrears → Outstanding.
    {
      id: 7, leaseCode: '#LM-0007', tenantId: 8, tenantName: 'Rohit Saxena',
      coTenants: [],
      propertyId: 2, propertyName: 'Sai Heights', unitId: 203, unitLabel: 'Unit 2C',
      pmName: 'Manoj Verma', leaseType: 'unit', roomLabel: '',
      rentAmount: 28000, depositAmount: 56000, rentDueDay: 1,
      startDate: '01/04/2026', endDate: '31/03/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(170, null, 2026, 4, 28000, 0, '01/04/2026', 'UPI', '210210210210'),
        pay(171, null, 2026, 5, 28000, 0, '02/05/2026', 'UPI', '220220220220')
      ]
    },
    // 8 — ROOM-WISE. Jun partial, no arrears → Partial.
    {
      id: 8, leaseCode: '#LM-0008', tenantId: 9, tenantName: 'Sana Sheikh',
      coTenants: [],
      propertyId: 4, propertyName: 'Mayur Vihar Apartments', unitId: 303, unitLabel: 'Unit 3A',
      pmName: 'Pooja Khanna', leaseType: 'room', roomLabel: 'Room C',
      rentAmount: 7000, depositAmount: 14000, rentDueDay: 1,
      startDate: '01/05/2026', endDate: '30/04/2027', status: 'Active',
      rentChanges: [],
      payments: [
        pay(180, null, 2026, 5, 7000, 0, '03/05/2026', 'UPI', '310310310310'),
        pay(181, null, 2026, 6, 3000, 0, '01/06/2026', 'Cash', '')
      ]
    }
  ];

  // Role scope helpers --------------------------------------------------------
  function all() { return RENT_LEASES; }
  function byId(id) { return RENT_LEASES.filter(function (l) { return l.id === Number(id); })[0] || null; }
  function forPm(propertyIds) {
    return RENT_LEASES.filter(function (l) { return propertyIds.indexOf(l.propertyId) !== -1; });
  }
  function forTenant(tenantId) {
    return RENT_LEASES.filter(function (l) {
      return l.tenantId === Number(tenantId) ||
        (l.coTenants || []).some(function (c) { return c.id === Number(tenantId); });
    });
  }
  // primary + co-tenant display name for a lease
  function tenantsLabel(l) {
    var names = [l.tenantName].concat((l.coTenants || []).map(function (c) { return c.name; }));
    return names.join(' + ');
  }

  global.RentData = {
    PROPERTIES: PROPERTIES,
    LEASES: RENT_LEASES,
    all: all, byId: byId, forPm: forPm, forTenant: forTenant, tenantsLabel: tenantsLabel
  };
})(typeof window !== 'undefined' ? window : this);
