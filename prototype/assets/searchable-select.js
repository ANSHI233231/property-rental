/* GharSetu — searchable-select (combobox) component.
 *
 * Progressive enhancement for Property / Unit pickers (CLAUDE.md rule #18):
 * any <select data-searchable> becomes a type-to-filter combobox. The native
 * <select> stays in the DOM as the form value + validation source (validation.js
 * keeps working), is visually hidden, and a `change` event is dispatched on every
 * selection so existing handlers (Paginator.setAttrFilter, cascades) fire unchanged.
 *
 * Dynamic / cascading option lists: after repopulating a native select's <option>s,
 * call SearchableSelect.refresh(idOrEl) to re-sync the combobox.
 *
 * No external dependencies. Keyboard: ↑/↓ move, Enter selects, Esc closes.
 */
(function () {
  var seq = 0;

  function enhance(sel) {
    if (sel.dataset.gsCb === '1') return;
    sel.dataset.gsCb = '1';

    var wrap = document.createElement('div');
    wrap.className = 'gs-combobox';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'input gs-cb-input';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

    var listId = 'gscb-' + (++seq);
    var list = document.createElement('ul');
    list.id = listId;
    list.className = 'gs-cb-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    input.setAttribute('aria-controls', listId);

    var labelEl = sel.id ? document.querySelector('label[for="' + sel.id + '"]') : null;
    if (labelEl) input.setAttribute('aria-label', labelEl.textContent.trim());
    if (sel.disabled) input.disabled = true;

    // Insert the wrapper before the native select in the DOM, then move the select
    // INSIDE the wrapper so its `position:absolute` is contained by the wrapper's
    // `position:relative` — keeping it from escaping and triggering page scroll.
    // The .field-error sibling (if any) stays after the wrapper in the parent.
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(input);
    wrap.appendChild(list);
    wrap.appendChild(sel);           // ← moved inside, not left as a sibling
    sel.classList.add('gs-cb-native');

    var filtered = [];
    var activeIdx = -1;

    function opts() { return Array.prototype.slice.call(sel.options); }

    function syncInput() {
      var o = sel.options[sel.selectedIndex];
      input.value = o ? o.textContent.trim() : '';
    }

    function render(q) {
      q = (q || '').toLowerCase();
      list.innerHTML = '';
      filtered = opts().filter(function (o) { return o.textContent.toLowerCase().indexOf(q) !== -1; });
      filtered.forEach(function (o, i) {
        var li = document.createElement('li');
        li.className = 'gs-cb-opt';
        li.id = listId + '-o' + i;
        li.setAttribute('role', 'option');
        li.textContent = o.textContent;
        if (o.selected) li.setAttribute('aria-selected', 'true');
        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(o); });
        list.appendChild(li);
      });
      activeIdx = -1;
    }

    function open() {
      if (sel.disabled) return;
      render('');
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      input.select();
    }
    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      syncInput();
    }
    function choose(o) {
      sel.value = o.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      syncInput();
      close();
    }
    function move(d) {
      if (list.hidden) open();
      if (!filtered.length) return;
      activeIdx = (activeIdx + d + filtered.length) % filtered.length;
      Array.prototype.forEach.call(list.children, function (li, i) {
        var on = i === activeIdx;
        li.classList.toggle('active', on);
        if (on) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
      });
    }

    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('input', function () {
      render(input.value);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        if (!list.hidden && activeIdx >= 0 && filtered[activeIdx]) { e.preventDefault(); choose(filtered[activeIdx]); }
      } else if (e.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 120); });

    // Validation focuses the (hidden) native select — forward that to the visible input.
    sel.addEventListener('focus', function () { input.focus(); });

    syncInput();
  }

  window.SearchableSelect = {
    initAll: function (root) {
      Array.prototype.forEach.call((root || document).querySelectorAll('select[data-searchable]'), enhance);
    },
    // Re-sync after a native select's options/disabled state changed (e.g. cascades).
    refresh: function (idOrEl) {
      var sel = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
      if (!sel) return;
      var wrap = sel.previousElementSibling;
      if (!wrap || !wrap.classList.contains('gs-combobox')) { enhance(sel); return; }
      var input = wrap.querySelector('.gs-cb-input');
      input.disabled = sel.disabled;
      var o = sel.options[sel.selectedIndex];
      input.value = o ? o.textContent.trim() : '';
    }
  };

  function init() { window.SearchableSelect.initAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
