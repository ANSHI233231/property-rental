/* GharSetu — canonical Property Types master (org-level, Admin-owned).
 * Single source for the Add / Edit Property "Type" field. Keep in sync with
 * prototype/admin/master-data/property-types.html.
 */
window.GHARSETU_PROPERTY_TYPES = [
  { id: 'apartment-complex',    name: 'Apartment Complex',    props: 12, status: 'active' },
  { id: 'independent-building', name: 'Independent Building', props: 6,  status: 'active' },
  { id: 'villa',                name: 'Villa',                props: 0,  status: 'active' },
  { id: 'independent-floor',    name: 'Independent Floor',    props: 0,  status: 'active' },
  { id: 'plot-land',            name: 'Plot / Land',          props: 0,  status: 'deactivated' }
];

/* Render the active types into a <select> (first type selected by default). */
window.renderPropertyTypeOptions = function (selectId, selectedId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var opts = '';
  window.GHARSETU_PROPERTY_TYPES.filter(function (t) { return t.status === 'active'; })
    .forEach(function (t) {
      var sel2 = (selectedId && selectedId === t.id) ? ' selected' : '';
      opts += '<option value="' + t.id + '"' + sel2 + '>' + t.name + '</option>';
    });
  sel.innerHTML = opts;
};
