/*
 * Single source for org amenities. Mirrors the values managed in
 * admin/master-data/amenities.html and offered as checkboxes in the
 * Add/Edit Property form. Consumers (property form, Check Availability
 * filter) should render from this list so a new amenity appears everywhere.
 *
 * App-port: becomes the org-scoped `amenities` master table; `id` is the
 * stable slug (secondary key), the DB PK is a numeric id (CLAUDE.md rule #19).
 */
window.GHARSETU_AMENITIES = [
  { id: 'cctv',           name: 'CCTV' },
  { id: 'gym',            name: 'Gym' },
  { id: 'lift',           name: 'Lift' },
  { id: 'parking',        name: 'Parking' },
  { id: 'power-backup',   name: 'Power backup' },
  { id: 'security',       name: 'Security' },
  { id: 'swimming-pool',  name: 'Swimming pool' },
  { id: 'water-softener', name: 'Water softener' }
];

/* Lookup helper: slug -> display name. */
window.amenityName = function (id) {
  for (var i = 0; i < window.GHARSETU_AMENITIES.length; i++) {
    if (window.GHARSETU_AMENITIES[i].id === id) return window.GHARSETU_AMENITIES[i].name;
  }
  return id;
};
