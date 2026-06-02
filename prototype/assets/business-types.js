/* GharSetu — canonical Business Types master (platform-level, Super-Admin owned).
 * Single source for the org sign-up "Type of Business" field. Keep in sync with
 * prototype/super-admin/master-data/business-types.html.
 */
window.GHARSETU_BUSINESS_TYPES = [
  { id: 'pg_hostel',           name: 'PG / Hostel',              orgs: 3, status: 'active' },
  { id: 'housing_society',     name: 'Housing Society',          orgs: 2, status: 'active' },
  { id: 'individual_landlord', name: 'Individual Landlord',      orgs: 4, status: 'active' },
  { id: 'property_mgmt_firm',  name: 'Property Management Firm', orgs: 2, status: 'active' },
  { id: 'co_living',           name: 'Co-living',                orgs: 1, status: 'active' }
];

/* Render the active types into a <select> (keeps the leading placeholder option).
   Retained for any single-select use sites (e.g. master-data filters). */
window.renderBusinessTypeOptions = function (selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var opts = '<option value="">Select business type</option>';
  window.GHARSETU_BUSINESS_TYPES.filter(function (t) { return t.status === 'active'; })
    .forEach(function (t) { opts += '<option value="' + t.id + '">' + t.name + '</option>'; });
  sel.innerHTML = opts;
};

/* Render the active types as a multi-select checkbox group.
   An organization can operate in multiple categories (e.g. PG + Co-living), so the
   org-signup page uses this multi-select variant. Each checkbox has name="biz-type[]"
   so a single querySelectorAll picks up all checked values. */
window.renderBusinessTypeCheckboxes = function (containerId, opts) {
  opts = opts || {};
  var groupName = opts.name || 'biz-type[]';
  var c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = window.GHARSETU_BUSINESS_TYPES
    .filter(function (t) { return t.status === 'active'; })
    .map(function (t) {
      return ''
        + '<label class="biz-type-chip">'
        +   '<input type="checkbox" name="' + groupName + '" value="' + t.id + '" />'
        +   '<span class="biz-type-chip-label">' + t.name + '</span>'
        + '</label>';
    }).join('');
};
