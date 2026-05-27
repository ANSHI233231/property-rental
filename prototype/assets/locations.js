/* GharSetu — canonical States + Cities (platform-level, Super-Admin owned).
 * Single source for the org sign-up "State → City" cascade. Mirrors
 * super-admin/master-data/states.html + cities.html. The platform is
 * Delhi-NCR-first, so only states that have at least one serviceable city
 * are offered at sign-up.
 */
window.GHARSETU_STATES = [
  { code: 'DL', name: 'Delhi' },
  { code: 'HR', name: 'Haryana' },
  { code: 'UP', name: 'Uttar Pradesh' },
  { code: 'MH', name: 'Maharashtra' },
  { code: 'RJ', name: 'Rajasthan' }
];

window.GHARSETU_CITIES = [
  { name: 'Delhi',     state: 'DL' },
  { name: 'Gurugram',  state: 'HR' },
  { name: 'Faridabad', state: 'HR' },
  { name: 'Noida',     state: 'UP' },
  { name: 'Ghaziabad', state: 'UP' }
];

/* Render the states that currently have ≥1 city into a <select>. */
window.renderStateOptions = function (selectId) {
  var sel = document.getElementById(selectId);
  if (!sel) return;
  var withCities = {};
  window.GHARSETU_CITIES.forEach(function (c) { withCities[c.state] = true; });
  var opts = '<option value="">Select state</option>';
  window.GHARSETU_STATES.filter(function (s) { return withCities[s.code]; })
    .forEach(function (s) { opts += '<option value="' + s.code + '">' + s.name + '</option>'; });
  sel.innerHTML = opts;
};

/* Populate a city <select> with the cities of the chosen state.
 * Empty stateCode → disabled placeholder ("Select state first"). */
window.renderCitiesForState = function (citySelectId, stateCode) {
  var sel = document.getElementById(citySelectId);
  if (!sel) return;
  if (!stateCode) {
    sel.innerHTML = '<option value="">Select state first</option>';
    sel.disabled = true;
    return;
  }
  var cities = window.GHARSETU_CITIES.filter(function (c) { return c.state === stateCode; });
  var opts = '<option value="">Select city</option>';
  cities.forEach(function (c) { opts += '<option value="' + c.name + '">' + c.name + '</option>'; });
  sel.innerHTML = opts;
  sel.disabled = cities.length === 0;
};
