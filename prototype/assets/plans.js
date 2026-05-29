/* GharSetu — canonical subscription plan catalogue (single source of truth).
 * Used by:
 *   - prototype/super-admin/plans.html      (Super Admin management screen)
 *   - prototype/index.html                  (public landing pricing cards)
 *   - prototype/organization-signup.html    (sign-up plan radio tiles)
 * All three render the SAME feature catalogue + per-plan flags so they never drift.
 */

/* Core entities — always included in every plan, not toggleable. These are the
   inventory primitives the platform manages: removing them would orphan org data
   (rooms created under one plan can't disappear on downgrade). Per-Room Leasing
   (in the feature catalogue below) gates lease creation scoped to a single room,
   but the Rooms entity itself is always available so inventory records survive
   any plan change. Read-only across all surfaces — never rendered as a checkbox. */
window.GHARSETU_CORE_FEATURES = [
  { id: 'properties', label: 'Properties' },
  { id: 'units',      label: 'Units' },
  { id: 'rooms',      label: 'Rooms' },
  { id: 'tenants',    label: 'Tenants' },
  { id: 'leases',     label: 'Leases' },
  { id: 'users',      label: 'Users' }
];

/* Platform feature catalogue — what a plan can switch on/off. */
window.GHARSETU_FEATURE_CATALOG = [
  { id: 'rent',          label: 'Rent Collection' },
  { id: 'maintenance',   label: 'Maintenance Requests' },
  { id: 'visitors',      label: 'Visitor Management' },
  { id: 'per-room',      label: 'Per-Room Leasing' },
  { id: 'delegation',    label: 'Task Delegation' },
  { id: 'impersonation', label: 'Admin Impersonation' },
  { id: 'settings',      label: 'Settings Customization' },
  { id: 'export',        label: 'Data Export (CSV)' }
];

/* Plans — caps + enabled feature ids + monthly price in paise (Tech convention #12).
 * id: integer PK (DB-owned, autoincrement). slug: stable machine-friendly handle. */
window.GHARSETU_PLANS = [
  { id: 1, slug: 'basic',    name: 'Basic',    cap: 5,    propertyCap: 1,    orgs: 4, status: 'active', popular: false,
    priceInr: 99900,
    features: ['rent', 'maintenance', 'visitors'] },
  { id: 2, slug: 'standard', name: 'Standard', cap: 20,   propertyCap: null, orgs: 5, status: 'active', popular: true,
    priceInr: 299900,
    features: ['rent', 'maintenance', 'visitors', 'per-room', 'impersonation', 'settings'] },
  { id: 3, slug: 'premium',  name: 'Premium',  cap: null, propertyCap: null, orgs: 1, status: 'active', popular: false,
    priceInr: 699900,
    features: ['rent', 'maintenance', 'visitors', 'per-room', 'delegation', 'impersonation', 'settings', 'export'] }
];

/* Render price as ₹X,XXX/mo using Indian digit grouping. priceInr is paise. */
window.gsPriceLabel = function (plan) {
  return '₹' + (plan.priceInr / 100).toLocaleString('en-IN') + '/mo';
};

window.GHARSETU_userCapLabel = function (p) {
  return p.cap === null ? 'Unlimited active users' : 'Up to ' + p.cap + ' active users';
};
window.GHARSETU_propertyCapLabel = function (p) {
  if (p.propertyCap === null) return 'Unlimited properties';
  return p.propertyCap + (p.propertyCap === 1 ? ' property' : ' properties');
};

/* Build a flat unified feature list for a plan — Core entities (always ✓)
   followed by the Optional catalogue (✓ if enabled, ✗ if not). One list, no
   labels, rendered the same on marketing cards, sign-up tiles, and the
   Super Admin plan cards. */
function gsCombinedFeatureList(plan, small) {
  var fs = small ? '12px' : '14px';
  var coreRows = window.GHARSETU_CORE_FEATURES.map(function (fc) {
    return '<li style="display:flex;align-items:center;gap:8px;font-size:' + fs + ';color:#212121;">'
         +   '<span style="color:#2E7D32;font-weight:700;flex-shrink:0;">✓</span> ' + fc.label
         + '</li>';
  });
  var optRows = window.GHARSETU_FEATURE_CATALOG.map(function (fc) {
    var on = plan.features.indexOf(fc.id) !== -1;
    var mark = on
      ? '<span style="color:#2E7D32;font-weight:700;flex-shrink:0;">✓</span>'
      : '<span style="color:#CFD8DC;font-weight:700;flex-shrink:0;">✗</span>';
    var style = on ? 'color:#546E7A;' : 'color:#CFD8DC;text-decoration:line-through;';
    return '<li style="display:flex;align-items:center;gap:8px;font-size:' + fs + ';' + style + '">' + mark + ' ' + fc.label + '</li>';
  });
  return coreRows.concat(optRows).join('');
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
      + '<div class="font-poppins font-bold text-charcoal" style="font-size:28px;margin-bottom:4px;">' + window.gsPriceLabel(p) + '</div>'
      + '<div class="font-poppins font-bold text-charcoal" style="font-size:22px;margin-bottom:2px;">' + window.GHARSETU_userCapLabel(p) + '</div>'
      + '<div class="muted" style="font-size:13px;margin-bottom:20px;">' + window.GHARSETU_propertyCapLabel(p) + '</div>'
      + '<ul style="list-style:none;padding:0;margin:0 0 24px;display:grid;grid-template-columns:1fr 1fr;column-gap:14px;row-gap:6px;">' + gsCombinedFeatureList(p, false) + '</ul>'
      + '<div class="font-poppins font-semibold ' + cta + '" style="font-size:14px;">Get started →</div>'
      + '</a>';
  }).join('');
};

/* ---- Sign-up radio tiles — modern pricing-card layout ----
   Visual hierarchy (top → bottom):
     1. Floating "Most Popular" pill (saffron, only on the popular plan)
     2. Plan name as a small slate uppercase label
     3. Big price (₹X,XXX) + "/month" period
     4. Two cap KPI chips side-by-side (users · properties)
     5. Flat feature list (Core ✓ + Optional ✓/✗) */
window.renderSignupPlanTiles = function (containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = window.GHARSETU_PLANS.map(function (p) {
    var userCap = (p.cap === null) ? '∞' : p.cap;
    var propCap = (p.propertyCap === null) ? '∞' : p.propertyCap;
    // Strip the "/mo" suffix; we render the period as a separate line below.
    var priceAmount = window.gsPriceLabel(p).replace('/mo', '');
    var popBadge = p.popular
      ? '<div class="signup-plan-badge">★ Most Popular</div>'
      : '';
    return ''
      + '<div class="signup-plan-tile' + (p.popular ? ' is-popular' : '') + '">'
      +   popBadge
      +   '<input class="plan-tile-input" type="radio" name="subscription-plan" id="plan-' + p.slug + '" value="' + p.id + '" aria-describedby="plan-group-error" />'
      +   '<label class="plan-tile-label" for="plan-' + p.slug + '">'
      +     '<div class="signup-plan-name">' + p.name + '</div>'
      +     '<div class="signup-plan-price">' + priceAmount + '</div>'
      +     '<div class="signup-plan-period">per month · billed monthly</div>'
      +     '<div class="signup-plan-caps">'
      +       '<div class="signup-plan-cap"><strong>' + userCap + '</strong><span>users</span></div>'
      +       '<div class="signup-plan-cap"><strong>' + propCap + '</strong><span>properties</span></div>'
      +     '</div>'
      +     '<div class="signup-plan-divider"></div>'
      +     '<ul class="signup-plan-features">' + gsCombinedFeatureList(p, true) + '</ul>'
      +   '</label>'
      + '</div>';
  }).join('');

  /* Auto-select the plan from the URL — set by the homepage / marketing cards
     (e.g. organization-signup.html?plan=2). Accepts numeric id or slug for
     backward compatibility with any older links still floating around. */
  try {
    var params = new URLSearchParams(window.location.search);
    var planParam = params.get('plan');
    if (planParam) {
      var match = window.GHARSETU_PLANS.filter(function (p) {
        return String(p.id) === planParam || p.slug === planParam;
      })[0];
      if (match) {
        var radio = document.getElementById('plan-' + match.slug);
        if (radio) radio.checked = true;
      }
    }
  } catch (e) { /* URLSearchParams unavailable — silently no-op */ }
};
