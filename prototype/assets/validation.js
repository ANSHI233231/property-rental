/* GharSetu form validation
 * Suppresses native browser tooltips (adds `novalidate` to every form)
 * and renders custom error messages directly below each invalid field.
 *
 * No setup needed in HTML — just include this script. It picks up native
 * constraints like `required`, `minlength`, `pattern`, `type="email"`.
 */
(function () {
  function getMessage(input) {
    var v = input.validity;
    if (v.valueMissing) return 'This field is required.';
    if (v.typeMismatch) {
      if (input.type === 'email') return 'Please enter a valid email address.';
      if (input.type === 'url')   return 'Please enter a valid URL.';
      return 'Please check the format.';
    }
    if (v.tooShort)        return 'Please enter at least ' + input.minLength + ' characters (you have ' + input.value.length + ').';
    if (v.tooLong)         return 'Please use no more than ' + input.maxLength + ' characters.';
    if (v.rangeUnderflow)  return 'Value must be at least ' + input.min + '.';
    if (v.rangeOverflow)   return 'Value must be at most '  + input.max + '.';
    if (v.patternMismatch) return input.title || 'Please match the requested format.';
    if (v.stepMismatch)    return 'Please pick a valid value.';
    return 'Please check this field.';
  }

  function ensureErrorEl(input) {
    var next = input.nextElementSibling;
    if (next && next.classList && next.classList.contains('field-error')) return next;
    var div = document.createElement('div');
    div.className = 'field-error';
    input.parentNode.insertBefore(div, input.nextSibling);
    return div;
  }

  function showError(input) {
    var err = ensureErrorEl(input);
    err.textContent = getMessage(input);
    err.classList.add('show');
    input.classList.add('error');
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    var next = input.nextElementSibling;
    if (next && next.classList && next.classList.contains('field-error')) {
      next.textContent = '';
      next.classList.remove('show');
    }
    input.classList.remove('error');
    input.removeAttribute('aria-invalid');
  }

  function validateForm(form) {
    var firstInvalid = null;
    var fields = form.querySelectorAll('input, select, textarea');
    Array.prototype.forEach.call(fields, function (input) {
      if (input.disabled) return;
      var t = input.type;
      if (t === 'hidden' || t === 'submit' || t === 'button' || t === 'reset') return;
      if (!input.checkValidity()) {
        showError(input);
        if (!firstInvalid) firstInvalid = input;
      } else {
        clearError(input);
      }
    });
    return firstInvalid;
  }

  function attachForm(form) {
    if (form.dataset.gsValidator === '1') return;
    form.dataset.gsValidator = '1';

    // 1) Suppress browser default tooltips
    form.setAttribute('novalidate', '');

    // 2) Preserve any inline onsubmit and run our validation first
    var original = form.onsubmit;
    form.onsubmit = null;

    form.addEventListener('submit', function (e) {
      var invalid = validateForm(form);
      if (invalid) {
        e.preventDefault();
        invalid.focus();
        return;
      }
      if (typeof original === 'function') {
        var result = original.call(form, e);
        if (result === false) e.preventDefault();
      }
    });

    // 3) Live UX: clear error as the user types, re-validate on blur
    Array.prototype.forEach.call(
      form.querySelectorAll('input, select, textarea'),
      function (input) {
        input.addEventListener('input',  function () { clearError(input); });
        input.addEventListener('change', function () { clearError(input); });
        input.addEventListener('blur',   function () {
          if (input.value && !input.checkValidity()) showError(input);
        });
      }
    );
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('form'), attachForm);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ---------------------------------------------------------------------------
 * Mobile drawer (sidebar slide-in on tablet/mobile)
 * Exposed as global helpers so inline onclick handlers can call them.
 * ------------------------------------------------------------------------ */
function openDrawer() {
  var s = document.querySelector('.sidebar');
  var b = document.querySelector('.drawer-backdrop');
  if (s) s.classList.add('open');
  if (b) b.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  var s = document.querySelector('.sidebar');
  var b = document.querySelector('.drawer-backdrop');
  if (s) s.classList.remove('open');
  if (b) b.classList.remove('open');
  document.body.style.overflow = '';
}
function toggleDrawer() {
  var s = document.querySelector('.sidebar');
  if (s && s.classList.contains('open')) closeDrawer(); else openDrawer();
}
/* Close drawer with Escape key */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeDrawer();
});
/* Close drawer when any link inside it is clicked (smooth nav UX) */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t) return;
  var link = t.closest && t.closest('.sidebar a.sidebar-link');
  if (link) closeDrawer();
});

/* ---------------------------------------------------------------------------
 * "More" bottom sheet — opens from slot 5 of the mobile tab bar on Admin + PM
 * pages. Mirrors apps/web/src/components/ui/MoreSheet.tsx behaviour.
 * Exposed globally so inline onclick handlers can call them.
 * ------------------------------------------------------------------------ */
function openMore() {
  var s = document.querySelector('.more-sheet');
  var b = document.querySelector('.more-sheet-backdrop');
  if (s) s.classList.add('open');
  if (b) b.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMore() {
  var s = document.querySelector('.more-sheet');
  var b = document.querySelector('.more-sheet-backdrop');
  if (s) s.classList.remove('open');
  if (b) b.classList.remove('open');
  document.body.style.overflow = '';
}
/* Close on Escape */
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMore();
});
/* Close when any link inside the sheet is clicked */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t) return;
  var link = t.closest && t.closest('.more-sheet a.more-sheet-link');
  if (link) closeMore();
});

/* ---------------------------------------------------------------------------
 * Account menu — sidebar bottom popover containing Sign out.
 * Replaces the old name/role footer text. One menu per page (in the sidebar).
 * ------------------------------------------------------------------------ */
function toggleAccountMenu(btn) {
  var trigger = btn || document.querySelector('.account-trigger');
  if (!trigger) return;
  var menu = document.getElementById('accountMenu');
  if (!menu) return;
  var isOpen = menu.classList.toggle('open');
  trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
function closeAccountMenu() {
  var menu = document.getElementById('accountMenu');
  var trigger = document.querySelector('.account-trigger');
  if (menu) menu.classList.remove('open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}
/* Click-outside / Escape close */
document.addEventListener('click', function (e) {
  var t = e.target;
  if (!t) return;
  var insideTrigger = t.closest && t.closest('.account-trigger');
  var insideMenu = t.closest && t.closest('.account-menu');
  if (!insideTrigger && !insideMenu) closeAccountMenu();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeAccountMenu();
    closeAccountSheet();
  }
});

/* ---------------------------------------------------------------------------
 * Account sheet — mobile bottom-sheet variant of the account menu.
 * Opens from the tabbar "Account" tab on tenant / maintenance / super-admin.
 * ------------------------------------------------------------------------ */
function openAccountSheet() {
  var s = document.getElementById('accountSheet');
  var b = document.querySelector('.account-sheet-backdrop');
  if (s) s.classList.add('open');
  if (b) b.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAccountSheet() {
  var s = document.getElementById('accountSheet');
  var b = document.querySelector('.account-sheet-backdrop');
  if (s) s.classList.remove('open');
  if (b) b.classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------------------------------------------------------------------------
 * Sidebar section toggle — collapses / expands a .sidebar-section on mobile.
 * Called from the .sidebar-section-header button via onclick="toggleSidebarSection(this)"
 * On desktop (≥1024px) this is a no-op — the section is always expanded via CSS.
 * ------------------------------------------------------------------------ */
function toggleSidebarSection(header) {
  var section = header.closest('.sidebar-section');
  if (!section) return;
  var collapsed = section.classList.toggle('collapsed');
  header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
}
