/* GharSetu — canonical Payment Methods master (platform-level, Super-Admin owned).
 * Single source for any Mark-Paid surface that needs the dropdown — Super Admin
 * invoice detail, Admin rent recording, etc. Mirror of the active rows on
 * prototype/super-admin/master-data/payment-methods.html.
 *
 * id           — numeric PK (Tech rule #19 — int autoincrement, owned by DB)
 * slug         — stable machine handle for code references; never used as the PK
 * name         — display label
 * status       — 'active' | 'deactivated' (only 'active' enters dropdowns)
 * refRequired  — whether a payment-reference field is shown/required when this
 *                method is selected (Super-Admin master toggle). Cash needs none.
 * refLabel     — what to ask for in the "Payment reference" field for this method
 *                (e.g. UPI wants a UPI ref / transaction id; Cash wants a receipt #)
 * refPlaceholder — input placeholder shown when this method is selected
 */
window.GHARSETU_PAYMENT_METHODS = [
  { id: 1, slug: 'upi',     name: 'UPI',                  status: 'active', refRequired: true,
    refLabel: 'UPI transaction ID',
    refPlaceholder: 'e.g. 412345678901' },
  { id: 2, slug: 'neft',    name: 'NEFT / Bank Transfer', status: 'active', refRequired: true,
    refLabel: 'UTR / NEFT reference',
    refPlaceholder: 'e.g. UTRN12345678' },
  { id: 3, slug: 'cash',    name: 'Cash',                 status: 'active', refRequired: false,
    refLabel: 'Receipt number',
    refPlaceholder: 'e.g. RCPT-001234' },
  { id: 4, slug: 'cheque',  name: 'Cheque',               status: 'active', refRequired: true,
    refLabel: 'Cheque number',
    refPlaceholder: 'e.g. 000456' },
  { id: 5, slug: 'imps',    name: 'IMPS',                 status: 'active', refRequired: true,
    refLabel: 'IMPS reference',
    refPlaceholder: 'e.g. IMPS123456789' }
];

/* Render active methods into a <select>. Keeps the leading placeholder option. */
window.renderPaymentMethodOptions = function (selectId, opts) {
  opts = opts || {};
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var placeholder = opts.placeholder || 'Select payment method';
  var html = '<option value="">' + placeholder + '</option>';
  window.GHARSETU_PAYMENT_METHODS
    .filter(function (m) { return m.status === 'active'; })
    .forEach(function (m) {
      html += '<option value="' + m.id + '" data-slug="' + m.slug + '">' + m.name + '</option>';
    });
  sel.innerHTML = html;
};

/* Lookup helpers — used by Mark-Paid surfaces to swap the reference field
   label/placeholder when the user picks a method. */
window.gsPaymentMethodById = function (id) {
  var n = Number(id);
  return window.GHARSETU_PAYMENT_METHODS.filter(function (m) { return m.id === n; })[0] || null;
};
window.gsPaymentMethodBySlug = function (slug) {
  return window.GHARSETU_PAYMENT_METHODS.filter(function (m) { return m.slug === slug; })[0] || null;
};
