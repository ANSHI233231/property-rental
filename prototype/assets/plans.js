/* GharSetu — canonical subscription plan catalogue (single source of truth).
 * Used by:
 *   - prototype/super-admin/plans.html      (Super Admin management screen)
 *   - prototype/index.html                  (public landing pricing cards)
 *   - prototype/organization-signup.html    (sign-up plan radio tiles)
 * All three render the SAME feature catalogue + per-plan flags so they never drift.
 */

/* Platform feature catalogue — what a plan can switch on/off. */
window.GHARSETU_FEATURE_CATALOG = [
  { id: 'rent',          label: 'Rent Collection' },
  { id: 'maintenance',   label: 'Maintenance Requests' },
  { id: 'visitors',      label: 'Visitor Management' },
  { id: 'per-room',      label: 'Per-Room Leasing' },
  { id: 'delegation',    label: 'Task Delegation' },
  { id: 'impersonation', label: 'Admin Impersonation' },
  { id: 'settings',      label: 'Settings Customization' },
  { id: 'export',        label: 'Data Export (CSV)' },
  { id: 'priority',      label: 'Priority Support' }
];

/* Plans — caps + enabled feature ids. */
window.GHARSETU_PLANS = [
  { id: 'basic',    name: 'Basic',    cap: 5,    propertyCap: 1,    orgs: 4, status: 'active', popular: false,
    features: ['rent', 'maintenance', 'visitors'] },
  { id: 'standard', name: 'Standard', cap: 20,   propertyCap: null, orgs: 5, status: 'active', popular: true,
    features: ['rent', 'maintenance', 'visitors', 'per-room', 'delegation', 'impersonation', 'settings'] },
  { id: 'premium',  name: 'Premium',  cap: null, propertyCap: null, orgs: 1, status: 'active', popular: false,
    features: ['rent', 'maintenance', 'visitors', 'per-room', 'delegation', 'impersonation', 'settings', 'export', 'priority'] }
];

window.GHARSETU_userCapLabel = function (p) {
  return p.cap === null ? 'Unlimited active users' : 'Up to ' + p.cap + ' active users';
};
window.GHARSETU_propertyCapLabel = function (p) {
  if (p.propertyCap === null) return 'Unlimited properties';
  return p.propertyCap + (p.propertyCap === 1 ? ' property' : ' properties');
};

/* Build the ✓ / ✗ feature list (full catalogue) for a plan — matches the Super Admin cards. */
function gsFeatureList(plan, small) {
  return window.GHARSETU_FEATURE_CATALOG.map(function (fc) {
    var on = plan.features.indexOf(fc.id) !== -1;
    var mark = on
      ? '<span style="color:#2E7D32;font-weight:700;flex-shrink:0;">✓</span>'
      : '<span style="color:#CFD8DC;font-weight:700;flex-shrink:0;">✗</span>';
    var style = on ? 'color:#546E7A;' : 'color:#CFD8DC;text-decoration:line-through;';
    var fs = small ? '12px' : '14px';
    return '<li style="display:flex;align-items:center;gap:8px;font-size:' + fs + ';' + style + '">' + mark + ' ' + fc.label + '</li>';
  }).join('');
}

/* ---- Home page (marketing) cards ---- */
window.renderMarketingPlans = function (containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = window.GHARSETU_PLANS.map(function (p) {
    var border = p.popular ? 'border:2px solid #FF6F00;' : '';
    var hover = p.popular ? '0 8px 24px rgba(255,111,0,0.2)' : '0 8px 24px rgba(0,0,0,0.1)';
    var cta = p.popular ? 'text-saffron' : 'text-royal-blue';
    var badge = p.popular ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#FF6F00;color:#fff;font-family:\'Poppins\',sans-serif;font-weight:600;font-size:11px;padding:3px 12px;border-radius:999px;white-space:nowrap;letter-spacing:0.5px;text-transform:uppercase;">Most Popular</div>' : '';
    return ''
      + '<a href="organization-signup.html?plan=' + p.id + '" class="card" style="display:block;text-decoration:none;cursor:pointer;' + border + 'transition:transform 200ms,box-shadow 200ms;padding:32px 24px;position:relative;" '
      + 'onmouseover="this.style.transform=\'translateY(-3px)\';this.style.boxShadow=\'' + hover + '\';" onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';">'
      + badge
      + '<div class="font-poppins font-semibold text-slate" style="font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">' + p.name + '</div>'
      + '<div class="font-poppins font-bold text-charcoal" style="font-size:22px;margin-bottom:2px;">' + window.GHARSETU_userCapLabel(p) + '</div>'
      + '<div class="muted" style="font-size:13px;margin-bottom:4px;">' + window.GHARSETU_propertyCapLabel(p) + '</div>'
      + '<div class="muted" style="font-size:13px;margin-bottom:20px;">Pricing on request</div>'
      + '<ul style="list-style:none;padding:0;margin:0 0 24px;display:flex;flex-direction:column;gap:8px;">' + gsFeatureList(p, false) + '</ul>'
      + '<div class="font-poppins font-semibold ' + cta + '" style="font-size:14px;">Get started →</div>'
      + '</a>';
  }).join('');
};

/* ---- Sign-up radio tiles ---- */
window.renderSignupPlanTiles = function (containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = window.GHARSETU_PLANS.map(function (p) {
    var popBadge = p.popular ? ' <span style="font-size:10px;background:#FF6F00;color:#fff;padding:2px 6px;border-radius:999px;font-weight:600;letter-spacing:0.4px;vertical-align:middle;margin-left:4px;white-space:nowrap;">Most Popular</span>' : '';
    var capShort = (p.cap === null ? 'Unlimited users' : 'Up to ' + p.cap + ' users') + ' · ' + window.GHARSETU_propertyCapLabel(p);
    return ''
      + '<div>'
      + '<input class="plan-tile-input" type="radio" name="subscription-plan" id="plan-' + p.id + '" value="' + p.id + '" aria-describedby="plan-group-error" />'
      + '<label class="plan-tile-label" for="plan-' + p.id + '">'
      + '<div style="margin-bottom:6px;">'
      + '<div class="font-poppins font-semibold" style="font-size:14px;color:#212121;">' + p.name + popBadge + '</div>'
      + '<div style="font-size:11px;color:#546E7A;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px;">' + capShort + '</div>'
      + '</div>'
      + '<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px;">' + gsFeatureList(p, true) + '</ul>'
      + '<div class="muted" style="font-size:11px;margin-top:8px;">Pricing on request</div>'
      + '</label>'
      + '</div>';
  }).join('');
};
