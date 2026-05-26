/* GharSetu — Admin Impersonation
 *
 * Storage key: sessionStorage['gharsetu_impersonation']
 * Value shape: {
 *   active: true,
 *   originalUser: "Aayush Kumar · Super Admin",
 *   impersonatedUser: "Sunita Arora · Admin",
 *   impersonatedOrg: "Green Valley Properties",
 *   startedAt: ISO-date string,
 *   returnDashboard: "../admin/dashboard.html"   (optional — defaults to ../admin/dashboard.html)
 * }
 *
 * Include this file after validation.js on every authenticated role-scoped page
 * (admin/*, pm/*, maintenance/*, tenant/*). Do NOT include on public pages
 * (login, forgot/reset password, organization-signup, index) or super-admin/*.
 *
 * Pattern mirrors validation.js — auto-runs on DOMContentLoaded, no setup needed.
 */
(function () {
  var STORAGE_KEY = 'gharsetu_impersonation';

  /* -------------------------------------------------------------------------
   * Locale helpers — DD/MM/YYYY HH:mm in Asia/Kolkata
   * ------------------------------------------------------------------------ */
  function formatIST(isoString) {
    try {
      var d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      // Format in Asia/Kolkata timezone
      var opts = {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      };
      var parts = new Intl.DateTimeFormat('en-IN', opts).formatToParts(d);
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      // DD/MM/YYYY HH:mm
      return map.day + '/' + map.month + '/' + map.year + ' ' + map.hour + ':' + map.minute;
    } catch (e) {
      return '';
    }
  }

  /* -------------------------------------------------------------------------
   * Read session state
   * ------------------------------------------------------------------------ */
  function readState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.active) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /* -------------------------------------------------------------------------
   * Write session state (used by start-session callers)
   * ------------------------------------------------------------------------ */
  function writeState(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  /* -------------------------------------------------------------------------
   * Clear all impersonation state
   * ------------------------------------------------------------------------ */
  function clearState() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /* -------------------------------------------------------------------------
   * Open end-session confirmation modal
   * ------------------------------------------------------------------------ */
  function openEndImpersonation() {
    var modal = document.getElementById('impersEndModal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    // Focus Cancel by default (safe action first per UX convention)
    var cancel = modal.querySelector('.btn-secondary');
    if (cancel) setTimeout(function () { cancel.focus(); }, 50);
  }

  /* -------------------------------------------------------------------------
   * Close end-session modal (Cancel)
   * ------------------------------------------------------------------------ */
  function closeEndImpersonation() {
    var modal = document.getElementById('impersEndModal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* -------------------------------------------------------------------------
   * Confirm end-session — clear state + redirect
   * ------------------------------------------------------------------------ */
  function confirmEndImpersonation() {
    var state = readState();
    var target = (state && state.returnDashboard) ? state.returnDashboard : '../admin/dashboard.html';
    clearState();
    // Remove DOM elements before redirect for clean visual
    var banner = document.getElementById('impersBanner');
    if (banner) banner.remove();
    var modal = document.getElementById('impersEndModal');
    if (modal) modal.remove();
    document.body.classList.remove('impers-active');
    document.body.style.overflow = '';
    window.location.assign(target);
  }

  /* -------------------------------------------------------------------------
   * Expose functions globally so inline onclick attributes and external callers
   * (e.g. users.html start-session modal) can reach them.
   * ------------------------------------------------------------------------ */
  window.openEndImpersonation    = openEndImpersonation;
  window.closeEndImpersonation   = closeEndImpersonation;
  window.confirmEndImpersonation = confirmEndImpersonation;
  window.gharsetu_impers_write   = writeState;

  /* -------------------------------------------------------------------------
   * Inject banner HTML
   * ------------------------------------------------------------------------ */
  function buildBanner(state) {
    // Parse impersonatedUser — expected format "First Last · Role"
    var parts    = (state.impersonatedUser || '').split(' · ');
    var iName    = parts[0] || '—';
    var iRole    = parts[1] || '—';
    var iOrg     = state.impersonatedOrg || '—';
    var started  = formatIST(state.startedAt);
    var actor    = state.originalUser || '—';

    var banner = document.createElement('div');
    banner.id = 'impersBanner';
    banner.className = 'impers-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    // Eye-with-slash SVG (18×18, currentColor)
    var iconSvg = '<svg class="impers-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="18" height="18">'
      + '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'
      + '<circle cx="12" cy="12" r="3"/>'
      + '<line x1="1" y1="1" x2="23" y2="23"/>'
      + '</svg>';

    // Warning icon for the banner pill
    var warnIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>'
      + '<line x1="12" y1="9" x2="12" y2="13"/>'
      + '<line x1="12" y1="17" x2="12.01" y2="17"/>'
      + '</svg>';

    banner.innerHTML = '<div class="impers-banner-inner">'
      + '<div class="impers-banner-left">'
      + warnIcon
      + '<div class="impers-banner-text">'
      + '<span class="impers-banner-line1">'
      + 'Impersonating <strong>' + escapeHtml(iName) + '</strong>'
      + ' <span class="impers-banner-role">(' + escapeHtml(iRole) + ')</span>'
      + ' at <strong>' + escapeHtml(iOrg) + '</strong>'
      + (started ? ' &middot; Started <span class="impers-banner-started">' + escapeHtml(started) + '</span>' : '')
      + '</span>'
      + '<span class="impers-banner-line2">'
      + 'Logged in as <strong class="impers-banner-actor">' + escapeHtml(actor) + '</strong>'
      + ' &middot; All actions are audited against your account'
      + '</span>'
      + '</div>'
      + '</div>'
      + '<button type="button" class="impers-end-btn" onclick="openEndImpersonation()" aria-haspopup="dialog">'
      + 'End impersonation'
      + '</button>'
      + '</div>';

    return banner;
  }

  /* -------------------------------------------------------------------------
   * HTML escape helper — never trust data from storage
   * ------------------------------------------------------------------------ */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* -------------------------------------------------------------------------
   * Inject end-session confirmation modal
   * ------------------------------------------------------------------------ */
  function buildEndModal(state) {
    var parts    = (state.impersonatedUser || '').split(' · ');
    var iName    = parts[0] || '—';
    var actor    = state.originalUser || '—';

    var modal = document.createElement('div');
    modal.id = 'impersEndModal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'impersEndTitle');

    modal.innerHTML = '<div class="modal">'
      + '<h3 id="impersEndTitle">End impersonation session?</h3>'
      + '<p class="muted text-sm" style="margin-top:8px;margin-bottom:20px">'
      + 'You will return to your dashboard. The audit log already shows every action you took as '
      + '<strong>' + escapeHtml(actor) + '</strong> acting on behalf of '
      + '<strong>' + escapeHtml(iName) + '</strong>.'
      + '</p>'
      + '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:24px">'
      + '<button type="button" class="btn btn-secondary" onclick="closeEndImpersonation()">Cancel</button>'
      + '<button type="button" class="btn btn-danger" onclick="confirmEndImpersonation()">End impersonation &amp; return</button>'
      + '</div>'
      + '</div>';

    // Close on backdrop click (outside the modal card)
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeEndImpersonation();
    });

    // Focus trap
    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeEndImpersonation(); return; }
      if (e.key !== 'Tab') return;
      var focusable = modal.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])');
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    return modal;
  }

  /* -------------------------------------------------------------------------
   * Main init — runs on DOMContentLoaded
   * ------------------------------------------------------------------------ */
  function init() {
    var state = readState();
    if (!state) return; // Not impersonating — leave the page untouched

    // Add body class so CSS offsets apply (sidebar top, main padding)
    document.body.classList.add('impers-active');

    // Inject banner as first child of <body>
    var banner = buildBanner(state);
    document.body.insertBefore(banner, document.body.firstChild);

    // Inject end-session modal right after banner
    var endModal = buildEndModal(state);
    document.body.insertBefore(endModal, banner.nextSibling);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
