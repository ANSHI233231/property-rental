/* GharSetu — global toast notifications (top-right). Single source.
 * Usage:
 *   gsToast('Saved.');                         // success (default)
 *   gsToast('Could not save.', 'error');       // error (persists until dismissed)
 *   gsToast('Heads up.', { type:'info', timeout:6000 });
 * Loaded on every page like validation.js. Styles live in assets/styles.css.
 */
(function () {
  var CONTAINER_ID = 'gs-toast-region';

  function container() {
    var el = document.getElementById(CONTAINER_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = CONTAINER_ID;
      el.className = 'gs-toast-region';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Notifications');
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  var ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.gsToast = function (message, opts) {
    if (typeof opts === 'string') opts = { type: opts };
    opts = opts || {};
    var type = ICONS[opts.type] ? opts.type : 'success';
    var timeout = (opts.timeout != null) ? opts.timeout : (type === 'error' ? 0 : 4000);

    var region = container();
    region.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    var t = document.createElement('div');
    t.className = 'gs-toast gs-toast--' + type;
    t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    t.innerHTML =
      '<span class="gs-toast-icon">' + ICONS[type] + '</span>' +
      '<span class="gs-toast-msg">' + esc(message) + '</span>' +
      '<button type="button" class="gs-toast-close" aria-label="Dismiss">&times;</button>';

    region.appendChild(t);
    while (region.children.length > 4) region.removeChild(region.firstChild);

    requestAnimationFrame(function () { t.classList.add('gs-toast--in'); });

    var timer = null;
    function dismiss() {
      if (t._gone) return; t._gone = true;
      t.classList.remove('gs-toast--in');
      t.classList.add('gs-toast--out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }
    function arm() { if (timeout > 0) timer = setTimeout(dismiss, timeout); }
    function disarm() { if (timer) { clearTimeout(timer); timer = null; } }

    t.querySelector('.gs-toast-close').addEventListener('click', dismiss);
    t.addEventListener('mouseenter', disarm);
    t.addEventListener('mouseleave', arm);
    t.addEventListener('focusin', disarm);
    t.addEventListener('focusout', arm);
    arm();
    return t;
  };
})();
