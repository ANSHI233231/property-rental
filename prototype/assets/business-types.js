/* GharSetu — canonical Business Types master (platform-level, Super-Admin owned).
 * Single source for the org sign-up "Type of Business" field. Keep in sync with
 * prototype/super-admin/master-data/business-types.html.
 */
window.GHARSETU_BUSINESS_TYPES = [
  { id: 'pg_hostel',           name: 'PG / Hostel',              orgs: 3, status: 'active' },
  { id: 'housing_society',     name: 'Housing Society',          orgs: 2, status: 'active' },
  { id: 'individual_landlord', name: 'Individual Landlord',      orgs: 4, status: 'active' },
  { id: 'property_mgmt_firm',  name: 'Property Management Firm', orgs: 2, status: 'active' },
  { id: 'co_living',           name: 'Co-living',                orgs: 1, status: 'active' },
  { id: 'other',               name: 'Other',                    orgs: 1, status: 'active' }
];

/* Render the active types into a <select> (keeps the leading placeholder option). */
window.renderBusinessTypeOptions = function (selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var opts = '<option value="">Select business type</option>';
  window.GHARSETU_BUSINESS_TYPES.filter(function (t) { return t.status === 'active'; })
    .forEach(function (t) { opts += '<option value="' + t.id + '">' + t.name + '</option>'; });
  sel.innerHTML = opts;
};
