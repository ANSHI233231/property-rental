/* GharSetu — canonical Maintenance Specializations master (org-level, Admin-owned).
 * Single source for the Add / Edit User "Specialization" field (Maintenance role).
 * A maintenance user can hold MORE THAN ONE specialization, so this renders as a
 * checkbox list — keep in sync with prototype/admin/master-data/specializations.html.
 */
window.GHARSETU_SPECIALIZATIONS = [
  { id: 'plumber',     name: 'Plumber',     staff: 1, status: 'active' },
  { id: 'electrician', name: 'Electrician', staff: 1, status: 'active' },
  { id: 'carpenter',   name: 'Carpenter',   staff: 1, status: 'active' },
  { id: 'hvac',        name: 'HVAC',        staff: 1, status: 'active' },
  { id: 'cleaner',     name: 'Cleaner',     staff: 0, status: 'active' },
  { id: 'general',     name: 'General',     staff: 0, status: 'active' },
  { id: 'painter',     name: 'Painter',     staff: 0, status: 'deactivated' }
];

/* Render the active specializations as a checkbox list into a container element.
 * selected = optional array of ids to pre-check. */
window.renderSpecializationCheckboxes = function (containerId, selected) {
  var box = document.getElementById(containerId);
  if (!box) return;
  selected = selected || [];
  var html = '';
  window.GHARSETU_SPECIALIZATIONS.filter(function (s) { return s.status === 'active'; })
    .forEach(function (s) {
      var checked = selected.indexOf(s.id) !== -1 ? ' checked' : '';
      html += '<label class="flex items-center gap-2" style="cursor:pointer;font-family:\'Inter\',sans-serif;font-size:14px;color:var(--color-charcoal)">' +
              '<input type="checkbox" name="specializations" value="' + s.id + '"' + checked +
              ' style="width:18px;height:18px;accent-color:var(--color-saffron)" /> ' + s.name + '</label>';
    });
  box.innerHTML = html;
};
