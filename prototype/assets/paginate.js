/* GharSetu — shared pagination component.
 *
 * Mirrors the server-side pagination contract the app port will use:
 *   /api/v1/<resource>?page=N&per_page=K&q=...&<filter>=<value>
 *
 * Markup contract on each list page:
 *
 *   <table class="data-table" id="tbl-users"> ... full mock dataset in tbody ... </table>
 *   <div class="pagination" data-paginate-for="tbl-users" data-per-page="10">
 *     <div class="pagination-info">Showing <span data-pg-from></span>–<span data-pg-to></span> of <span data-pg-total></span></div>
 *     <div class="pagination-controls">
 *       <button class="pagination-btn" data-pg-prev aria-label="Previous page">‹</button>
 *       <div class="pagination-pages" data-pg-pages></div>
 *       <button class="pagination-btn" data-pg-next aria-label="Next page">›</button>
 *     </div>
 *     <div class="pagination-per-page">
 *       <select data-pg-per-page>
 *         <option value="10" selected>10 / page</option>
 *         <option value="25">25 / page</option>
 *         <option value="50">50 / page</option>
 *       </select>
 *     </div>
 *   </div>
 *
 * Filter tiles (optional) link to the table by id:
 *
 *   <button class="filter-tile active" data-tile-for="tbl-users" data-tile-filter="all"
 *           onclick="Paginator.setFilter('tbl-users', 'all', this)">
 *     <span class="filter-tile-count" data-pg-count></span>
 *     <span class="filter-tile-label">All</span>
 *   </button>
 *
 * Tile match strategy: by default, the paginator compares the tile's
 * data-tile-filter value against each <tr>'s data-status attribute (or
 * data-role / data-category — see PG_FILTER_ATTRS). 'all' matches everything.
 *
 * Search input wires via data-pg-search="<tableId>":
 *
 *   <input class="input" data-pg-search="tbl-users" />
 *
 * The paginator listens to `input` events on it.
 *
 * Public API:
 *   Paginator.refresh(tableId)              — recompute filter + tile counts + pagination
 *   Paginator.setFilter(tableId, key, btn)  — set the active tile filter and refresh
 *   Paginator.setSearch(tableId, q)         — set the search query and refresh
 *
 * State persistence: URL params per table — <tableId>_page, <tableId>_per,
 * <tableId>_q, <tableId>_f. Stored via history.replaceState.
 */
(function () {
  var PG_FILTER_ATTRS = ['data-status', 'data-role', 'data-category', 'data-priority', 'data-plan', 'data-filter'];
  var MAX_VISIBLE_PAGES = 7;

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function $(sel, root)  { return (root || document).querySelector(sel); }
  function fmtNum(n) { return n.toLocaleString('en-IN'); }

  function getUrlParam(name) {
    var u = new URL(window.location.href);
    return u.searchParams.get(name);
  }
  function setUrlParam(name, value) {
    var u = new URL(window.location.href);
    if (value === null || value === undefined || value === '') u.searchParams.delete(name);
    else u.searchParams.set(name, value);
    history.replaceState(null, '', u.toString());
  }

  // -------------------- State per table --------------------
  var STATE = {}; // { [tableId]: { page, perPage, q, filter } }

  function getState(tableId) {
    if (!STATE[tableId]) {
      var pg = parseInt(getUrlParam(tableId + '_page'), 10) || 1;
      var pp = parseInt(getUrlParam(tableId + '_per'), 10) || null;
      var q  = getUrlParam(tableId + '_q') || '';
      var f  = getUrlParam(tableId + '_f') || 'all';
      STATE[tableId] = { page: pg, perPage: pp, q: q, filter: f, attr: {} };
    }
    return STATE[tableId];
  }

  // -------------------- Filter matching --------------------

  function trMatchesFilter(tr, filterKey) {
    if (!filterKey || filterKey === 'all') return true;
    for (var i = 0; i < PG_FILTER_ATTRS.length; i++) {
      var attr = PG_FILTER_ATTRS[i];
      var v = tr.getAttribute(attr);
      if (v != null && v.toLowerCase() === filterKey.toLowerCase()) return true;
    }
    return false;
  }

  function trMatchesSearch(tr, q) {
    if (!q) return true;
    var text = (tr.textContent || '').toLowerCase();
    return text.indexOf(q.toLowerCase()) !== -1;
  }

  // Secondary attribute filters (e.g. a Status <select> alongside the tile filter).
  // AND-combined with search + tile filter. Empty/absent value = no constraint.
  function trMatchesAttrs(tr, attr) {
    if (!attr) return true;
    for (var a in attr) {
      if (!attr.hasOwnProperty(a)) continue;
      var want = attr[a];
      if (!want) continue;
      var have = tr.getAttribute(a);
      if (have == null || have.toLowerCase() !== String(want).toLowerCase()) return false;
    }
    return true;
  }

  // -------------------- Tile-count recompute --------------------

  function refreshTileCounts(tableId, allRows, currentSearch, attrFilters) {
    // Counts are computed against the search + secondary-attr set (but NOT the filter-tile set),
    // so tile counts represent "if I picked this filter, how many would I see".
    var tiles = $$('[data-tile-for="' + tableId + '"]');
    tiles.forEach(function (tile) {
      var key = tile.getAttribute('data-tile-filter') || 'all';
      var count = 0;
      for (var i = 0; i < allRows.length; i++) {
        var tr = allRows[i];
        if (!trMatchesSearch(tr, currentSearch)) continue;
        if (!trMatchesAttrs(tr, attrFilters)) continue;
        if (trMatchesFilter(tr, key)) count++;
      }
      var slot = tile.querySelector('[data-pg-count]');
      if (slot) slot.textContent = fmtNum(count);
    });
  }

  // -------------------- Render --------------------

  function renderPages(pg, total, current) {
    var pagesEl = $('[data-pg-pages]', pg);
    pagesEl.innerHTML = '';
    if (total <= 1) return;

    var nums = [];
    if (total <= MAX_VISIBLE_PAGES) {
      for (var i = 1; i <= total; i++) nums.push(i);
    } else {
      // Always show 1, current-1, current, current+1, last. Insert ellipses where needed.
      nums.push(1);
      if (current > 3) nums.push('…');
      for (var n = Math.max(2, current - 1); n <= Math.min(total - 1, current + 1); n++) nums.push(n);
      if (current < total - 2) nums.push('…');
      nums.push(total);
    }

    nums.forEach(function (n) {
      if (n === '…') {
        var sp = document.createElement('span');
        sp.className = 'pagination-ellipsis';
        sp.textContent = '…';
        sp.setAttribute('aria-hidden', 'true');
        pagesEl.appendChild(sp);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pagination-page' + (n === current ? ' active' : '');
      if (n === current) b.setAttribute('aria-current', 'page');
      b.setAttribute('aria-label', 'Page ' + n);
      b.textContent = String(n);
      b.dataset.pgGoto = String(n);
      pagesEl.appendChild(b);
    });
  }

  function paginate(tableId) {
    var pg = $('.pagination[data-paginate-for="' + tableId + '"]');
    if (!pg) return;
    var table = document.getElementById(tableId);
    if (!table) return;
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var allRows = Array.prototype.slice.call(tbody.rows);
    var state = getState(tableId);

    // 1) Apply search → matched rows
    var searched = allRows.filter(function (tr) { return trMatchesSearch(tr, state.q); });

    // 2) Tile counts use the searched + secondary-attr set, INDEPENDENT of the active tile.
    refreshTileCounts(tableId, allRows, state.q, state.attr);

    // 3) Apply tile filter + secondary attribute filters on top of searched set → filtered rows
    var filtered = searched.filter(function (tr) {
      return trMatchesFilter(tr, state.filter) && trMatchesAttrs(tr, state.attr);
    });

    // 4) Pagination math
    var perPage = state.perPage || parseInt(pg.dataset.perPage, 10) || 10;
    var total = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / perPage));
    var page = Math.min(Math.max(1, state.page), totalPages);
    state.page = page;
    state.perPage = perPage;

    var from = total === 0 ? 0 : (page - 1) * perPage + 1;
    var to   = Math.min(total, page * perPage);

    // 5) Hide all rows, then show only the current page slice of filtered rows.
    //    Stamp a running serial number into any [data-pg-serial] cell so it
    //    continues across pages/filters (page 2 picks up where page 1 ended).
    allRows.forEach(function (tr) { tr.style.display = 'none'; });
    for (var i = from - 1; i < to; i++) {
      filtered[i].style.display = '';
      var serialCell = filtered[i].querySelector('[data-pg-serial]');
      if (serialCell) serialCell.textContent = fmtNum(i + 1);
    }

    // 6) Update info + per-page selector + page buttons
    var fromEl = $('[data-pg-from]', pg);   if (fromEl) fromEl.textContent = fmtNum(from);
    var toEl   = $('[data-pg-to]', pg);     if (toEl)   toEl.textContent   = fmtNum(to);
    var totEl  = $('[data-pg-total]', pg);  if (totEl)  totEl.textContent  = fmtNum(total);
    var perSel = $('[data-pg-per-page]', pg);
    if (perSel && parseInt(perSel.value, 10) !== perPage) perSel.value = String(perPage);
    var prevBtn = $('[data-pg-prev]', pg);  if (prevBtn) prevBtn.disabled = page <= 1;
    var nextBtn = $('[data-pg-next]', pg);  if (nextBtn) nextBtn.disabled = page >= totalPages;

    renderPages(pg, totalPages, page);

    // 7) URL state
    setUrlParam(tableId + '_page', page > 1 ? page : null);
    setUrlParam(tableId + '_per',  perPage !== 10 ? perPage : null);
    setUrlParam(tableId + '_q',    state.q || null);
    setUrlParam(tableId + '_f',    state.filter && state.filter !== 'all' ? state.filter : null);
  }

  // -------------------- Wiring --------------------

  function wirePagination(pg) {
    var tableId = pg.dataset.paginateFor;
    if (!tableId) return;

    pg.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.matches('[data-pg-prev]')) { getState(tableId).page--; paginate(tableId); return; }
      if (t.matches('[data-pg-next]')) { getState(tableId).page++; paginate(tableId); return; }
      var pgo = t.closest && t.closest('[data-pg-goto]');
      if (pgo) {
        var n = parseInt(pgo.dataset.pgGoto, 10);
        getState(tableId).page = n;
        paginate(tableId);
      }
    });

    var perSel = $('[data-pg-per-page]', pg);
    if (perSel) {
      perSel.addEventListener('change', function () {
        getState(tableId).perPage = parseInt(perSel.value, 10);
        getState(tableId).page = 1;
        paginate(tableId);
      });
    }
  }

  function wireSearchInput(input) {
    var tableId = input.dataset.pgSearch;
    if (!tableId) return;
    var state = getState(tableId);
    if (state.q && !input.value) input.value = state.q;
    input.addEventListener('input', function () {
      state.q = input.value || '';
      state.page = 1;
      paginate(tableId);
    });
  }

  function wireTile(tile) {
    var tableId = tile.dataset.tileFor;
    if (!tileId(tile) || !tableId) return;
    tile.addEventListener('click', function () {
      Paginator.setFilter(tableId, tile.dataset.tileFilter || 'all', tile);
    });
  }
  function tileId(t) { return t.dataset.tileFilter; }

  // -------------------- Public API --------------------

  window.Paginator = {
    refresh: function (tableId) { paginate(tableId); },
    setFilter: function (tableId, key, btn) {
      var state = getState(tableId);
      state.filter = key || 'all';
      state.page = 1;
      // Active-tile visual update
      $$('[data-tile-for="' + tableId + '"]').forEach(function (t) { t.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      paginate(tableId);
    },
    setSearch: function (tableId, q) {
      var state = getState(tableId);
      state.q = q || '';
      state.page = 1;
      paginate(tableId);
    },
    // Secondary filter via a dropdown/select, AND-combined with the tile filter.
    // value '' / null clears the constraint on that attribute.
    setAttrFilter: function (tableId, attr, value) {
      var state = getState(tableId);
      if (!state.attr) state.attr = {};
      if (value === null || value === undefined || value === '') delete state.attr[attr];
      else state.attr[attr] = value;
      state.page = 1;
      paginate(tableId);
    },
  };

  // -------------------- Init --------------------

  function init() {
    $$('.pagination[data-paginate-for]').forEach(wirePagination);
    $$('[data-pg-search]').forEach(wireSearchInput);
    $$('[data-tile-for][data-tile-filter]').forEach(wireTile);
    // Restore tile active state from URL filter param + run first paginate.
    var seen = {};
    $$('.pagination[data-paginate-for]').forEach(function (pg) {
      var tid = pg.dataset.paginateFor;
      if (seen[tid]) return;
      seen[tid] = true;
      var state = getState(tid);
      $$('[data-tile-for="' + tid + '"]').forEach(function (t) {
        if ((t.dataset.tileFilter || 'all') === state.filter) t.classList.add('active');
        else t.classList.remove('active');
      });
      paginate(tid);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
