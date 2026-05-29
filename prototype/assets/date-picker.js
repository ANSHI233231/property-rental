/* GharSetu — DD/MM/YYYY date picker (vanilla JS, no deps).
 *
 * Progressive enhancement: any <input data-datepicker> becomes a click-to-open
 * calendar popover. The native <input> stays a real form field (validators
 * read .value), so the existing wizard logic that already expects DD/MM/YYYY
 * keeps working without changes — picking a date just programmatically sets
 * the value and dispatches `input` + `change` so any oninput handlers fire.
 *
 * Supported data attributes:
 *   data-datepicker             — marker; required to enhance the input
 *   data-min-date="today"|D/M/Y — earliest selectable date
 *   data-max-date="D/M/Y"       — latest selectable date
 *   data-pair-min="<inputId>"   — when computing the effective min, also clamp
 *                                 to the partner input's current value. Used on
 *                                 an End picker so End cannot precede Start.
 *   data-pair-max="<inputId>"   — when computing the effective max, also clamp
 *                                 to the partner input's current value. Used on
 *                                 a Start picker so Start cannot exceed End.
 *
 * Keyboard: Esc closes. Click outside closes. Today highlighted in saffron;
 * selected day saffron-filled.
 *
 * Mon-start week (Indian convention). DD/MM/YYYY output (locale per CLAUDE.md).
 */
(function () {
  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var WEEK_DAYS   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function parseDDMMYYYY(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || '').trim());
    if (!m) return null;
    var d = +m[1], mo = +m[2] - 1, y = +m[3];
    var dt = new Date(y, mo, d);
    return (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) ? dt : null;
  }

  function fmtDDMMYYYY(d) {
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /* Resolve a min/max bound from a data-attribute value.
     Accepts 'today', DD/MM/YYYY, or ISO YYYY-MM-DD. Returns a Date at 00:00 local
     or null if unparseable. */
  function resolveBound(v) {
    if (!v) return null;
    var t;
    if (v === 'today') {
      t = new Date();
      return new Date(t.getFullYear(), t.getMonth(), t.getDate());
    }
    var dmy = parseDDMMYYYY(v);
    if (dmy) return dmy;
    /* Allow ISO fallback (YYYY-MM-DD) for forward-compat with the eventual app. */
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      var p = v.split('-');
      return new Date(+p[0], +p[1] - 1, +p[2]);
    }
    return null;
  }

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function enhance(input) {
    if (input.dataset.gsDp === '1') return;
    input.dataset.gsDp = '1';

    /* Wrap the input so the popover can be positioned relative to it. */
    var wrap = document.createElement('div');
    wrap.className = 'gs-dp-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    /* Calendar icon overlay (visual cue that the field is a picker). */
    var icon = document.createElement('span');
    icon.className = 'gs-dp-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    wrap.appendChild(icon);

    /* The popover. */
    var pop = document.createElement('div');
    pop.className = 'gs-dp-pop';
    pop.hidden = true;
    wrap.appendChild(pop);

    /* Current view (month + year being displayed). Re-initialised on open. */
    var view = { y: 0, m: 0 };

    function initView() {
      var existing = parseDDMMYYYY(input.value);
      var base = existing || new Date();
      view.y = base.getFullYear();
      view.m = base.getMonth();
    }

    /* Resolve a paired-input bound: read the partner input's value (DD/MM/YYYY)
       and return it as a Date, or null if empty / unparseable. */
    function pairBound(attr) {
      var otherId = input.dataset[attr];
      if (!otherId) return null;
      var other = document.getElementById(otherId);
      if (!other || !other.value) return null;
      return parseDDMMYYYY(other.value);
    }

    function render() {
      var minD = resolveBound(input.dataset.minDate);
      var maxD = resolveBound(input.dataset.maxDate);
      /* Pair-bounds override only if they tighten the window.
         Pair-min lifts the floor; pair-max lowers the ceiling. */
      var pmin = pairBound('pairMin');
      if (pmin && (!minD || pmin > minD)) minD = pmin;
      var pmax = pairBound('pairMax');
      if (pmax && (!maxD || pmax < maxD)) maxD = pmax;
      var selected = parseDDMMYYYY(input.value);
      var firstOfMonth = new Date(view.y, view.m, 1);
      /* Mon-first week. JS getDay() returns 0=Sun..6=Sat — shift so Mon=0. */
      var offsetStart = (firstOfMonth.getDay() + 6) % 7;
      var daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
      var today = new Date(); today.setHours(0, 0, 0, 0);

      var html = '';
      html += '<div class="gs-dp-header">'
           +   '<button type="button" class="gs-dp-nav" data-nav="prev" aria-label="Previous month">&#8249;</button>'
           +   '<div class="gs-dp-title">' + MONTH_NAMES[view.m] + ' ' + view.y + '</div>'
           +   '<button type="button" class="gs-dp-nav" data-nav="next" aria-label="Next month">&#8250;</button>'
           + '</div>';
      html += '<div class="gs-dp-grid">';
      WEEK_DAYS.forEach(function (d) {
        html += '<div class="gs-dp-dow">' + d + '</div>';
      });
      for (var i = 0; i < offsetStart; i++) {
        html += '<div class="gs-dp-empty"></div>';
      }
      for (var dd = 1; dd <= daysInMonth; dd++) {
        var date = new Date(view.y, view.m, dd);
        var disabled = (minD && date < minD) || (maxD && date > maxD);
        var isSelected = sameDay(date, selected);
        var isToday = sameDay(date, today);
        var cls = 'gs-dp-day';
        if (disabled) cls += ' gs-dp-day-disabled';
        if (isSelected) cls += ' gs-dp-day-selected';
        if (isToday) cls += ' gs-dp-day-today';
        html += '<button type="button" class="' + cls + '" data-day="' + dd + '"'
              + (disabled ? ' disabled aria-disabled="true"' : '') + '>' + dd + '</button>';
      }
      html += '</div>';
      pop.innerHTML = html;
    }

    function open() {
      if (input.disabled || input.readOnly) return;
      initView();
      render();
      pop.hidden = false;
    }
    function close() { pop.hidden = true; }

    /* Input → open. We listen on click + focus + keydown so all entry paths work. */
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    icon.addEventListener('click', function (e) { e.preventDefault(); open(); input.focus(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown' && pop.hidden) { e.preventDefault(); open(); }
    });

    /* Popover delegated clicks — month nav + day select. mousedown prevents
       the focus-out blur from closing the popover before our click registers. */
    pop.addEventListener('mousedown', function (e) { e.preventDefault(); });
    pop.addEventListener('click', function (e) {
      var t = e.target.closest('[data-nav], [data-day]');
      if (!t) return;
      e.preventDefault();
      if (t.dataset.nav === 'prev') {
        view.m--;
        if (view.m < 0) { view.m = 11; view.y--; }
        render();
        return;
      }
      if (t.dataset.nav === 'next') {
        view.m++;
        if (view.m > 11) { view.m = 0; view.y++; }
        render();
        return;
      }
      if (t.dataset.day) {
        if (t.disabled) return;
        var d = +t.dataset.day;
        var picked = new Date(view.y, view.m, d);
        input.value = fmtDDMMYYYY(picked);
        /* Fire both events so any oninput / onchange handler the page already
           has — conflict checks, summary updates, validation — runs naturally. */
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      }
    });

    /* Click outside closes. Bound once on document; cheap. */
    document.addEventListener('click', function (e) {
      if (pop.hidden) return;
      if (!wrap.contains(e.target)) close();
    });
  }

  window.GsDatePicker = {
    initAll: function (root) {
      Array.prototype.forEach.call(
        (root || document).querySelectorAll('input[data-datepicker]'),
        enhance
      );
    },
    /* Re-scan after dynamic markup is inserted (e.g., a modal that includes a
       date field). Idempotent — already-enhanced inputs are skipped. */
    refresh: function (root) { this.initAll(root); }
  };

  function init() { window.GsDatePicker.initAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
