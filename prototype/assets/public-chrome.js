/* GharSetu — shared public-page chrome (top nav + footer).
 * Single source so every public marketing/legal page shows an identical
 * header and footer (no drift). Used by:
 *   index.html · contact.html · privacy.html · terms.html
 *
 * Usage on a page:
 *   <div id="gs-public-nav"></div>      <!-- where the nav should render -->
 *   ... page content ...
 *   <div id="gs-public-footer"></div>   <!-- where the footer should render -->
 *   <script src="assets/public-chrome.js"></script>
 *
 * If a placeholder is absent the nav is prepended / the footer appended to <body>.
 * All public pages live at the prototype root, so links are same-directory.
 *
 * v2 (2026-06-01) — light-forward glass redesign: light blurred nav with an
 * inline-SVG saffron logo mark + centre section links + Login/Register;
 * deep-navy footer (--surface-deep #131B2E) with Product / Support columns.
 */
(function () {
  var CSS = [
    '#siteNav { transition: box-shadow 250ms ease, background 250ms ease; }',
    '.site-logo { color: var(--color-charcoal); text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }',
    '.site-logo .logo-mark { color: var(--color-saffron); display: inline-flex; }',
    '.nav-link { position: relative; color: var(--color-slate); font-family: "Poppins", sans-serif; font-weight: 600; font-size: 14px; text-decoration: none; padding-bottom: 4px; transition: color 200ms ease; }',
    '.nav-link::after { content: ""; position: absolute; left: 0; bottom: 0; height: 2px; width: 0; background: var(--color-saffron); transition: width 220ms ease; }',
    '.nav-link:hover { color: var(--color-saffron); }',
    '.nav-link:hover::after { width: 100%; }',
    '.nav-link:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 4px; border-radius: 2px; }',
    /* Nav buttons — Login = outlined navy, Register = solid saffron; both glow + scale on hover (btn-glow). */
    '.nav-btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 22px; border-radius: 8px; font-family: "Poppins", sans-serif; font-weight: 600; font-size: 13px; text-decoration: none; transition: background 200ms ease, color 200ms ease, box-shadow 200ms ease, transform 120ms ease; }',
    '.nav-btn-ghost { color: var(--color-navy); border: 1.5px solid var(--color-navy); background: transparent; }',
    '.nav-btn-ghost:hover { background: rgba(26,35,126,0.05); box-shadow: 0 0 20px rgba(255,111,0,0.35); transform: scale(1.02); }',
    '.nav-btn-solid { color: #fff; background: var(--color-saffron); box-shadow: 0 6px 16px rgba(255,111,0,0.22); }',
    '.nav-btn-solid:hover { box-shadow: 0 0 20px rgba(255,111,0,0.45); transform: scale(1.02); }',
    '.nav-btn:active { transform: scale(0.96); }',
    '.nav-btn:focus-visible { outline: 2px solid var(--color-saffron); outline-offset: 2px; }',
    '.nav-scrolled { box-shadow: 0 6px 24px rgba(15,23,42,0.08); }',
    '.nav-center { display: none; }',
    '@media (min-width:1024px){ .nav-center { display: flex; align-items: center; gap: 32px; } }',
    '@media (max-width:1023px){ .nav-register { display: none; } }',
    '.gs-footer { background: var(--surface-deep); padding: 56px 0 32px; }',
    '.gs-foot-link { color: rgba(255,255,255,0.62); font-family: "Inter", sans-serif; font-size: 14px; text-decoration: none; transition: color 150ms; }',
    '.gs-foot-link:hover { color: #fff; }',
    '@media (prefers-reduced-motion: reduce){ #siteNav, .site-logo, .nav-link, .nav-btn, .gs-foot-link { transition: none; } .nav-btn:hover, .nav-btn:active { transform: none; } }'
  ].join('\n');

  var LOGO_MARK =
    '<span class="logo-mark" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">'
    + '<path d="M3 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v4h6a1 1 0 0 1 1 1v11h-7v-4h-2v4H3Zm2-2h2v-2H5v2Zm0-4h2v-2H5v2Zm0-4h2V9H5v2Zm4 8h2v-2H9v2Zm0-4h2v-2H9v2Zm0-4h2V9H9v2Zm6 8h4v-2h-4v2Zm0-4h4v-2h-4v2Z"/>'
    + '</svg></span>';

  var NAV_HTML =
    '<nav id="siteNav" style="background:rgba(248,249,255,0.85); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border-bottom:1px solid rgba(198,198,205,0.4); position:sticky; top:0; z-index:40;">'
    + '<div class="max-w-6xl mx-auto px-6 flex items-center justify-between" style="height:76px;">'
    + '<a href="index.html" class="site-logo font-poppins font-bold text-2xl tracking-wide">' + LOGO_MARK + '<span>Ghar<span style="color:var(--color-saffron);">Setu</span></span></a>'
    + '<div class="nav-center">'
    + '<a href="index.html#capabilities" class="nav-link">Features</a>'
    + '<a href="index.html#how" class="nav-link">How it Works</a>'
    + '<a href="index.html#plans" class="nav-link">Pricing</a>'
    + '</div>'
    + '<div class="flex items-center" style="gap:14px;">'
    + '<a href="login.html" class="nav-btn nav-btn-ghost">Login</a>'
    + '<a href="organization-signup.html" class="nav-btn nav-btn-solid nav-register">Register</a>'
    + '</div></div></nav>';

  function footLink(href, label) {
    return '<li><a href="' + href + '" class="gs-foot-link">' + label + '</a></li>';
  }

  var FOOTER_HTML =
    '<footer class="gs-footer">'
    + '<div class="max-w-6xl mx-auto px-6">'
    + '<div style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:32px; margin-bottom:36px;">'
    + '<div style="max-width:280px;">'
    + '<a href="index.html" class="font-poppins font-bold" style="font-size:22px; color:#fff; text-decoration:none; letter-spacing:0.5px;">Ghar<span style="color:var(--color-saffron);">Setu</span></a>'
    + '<p style="color:rgba(255,255,255,0.62); font-size:14px; margin-top:10px; line-height:1.6;">Multi-tenant property rental management — organized, role-scoped, auditable.</p>'
    + '</div>'
    + '<div style="display:flex; gap:64px; flex-wrap:wrap;">'
    + '<div>'
    + '<div class="font-poppins font-semibold" style="color:rgba(255,255,255,0.85); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">Product</div>'
    + '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px;">' + footLink('index.html#capabilities', 'Features') + footLink('index.html#plans', 'Pricing') + '</ul>'
    + '</div>'
    + '<div>'
    + '<div class="font-poppins font-semibold" style="color:rgba(255,255,255,0.85); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">Support</div>'
    + '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px;">' + footLink('contact.html', 'Contact') + footLink('privacy.html', 'Privacy') + footLink('terms.html', 'Terms') + '</ul>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '<div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:20px; color:rgba(255,255,255,0.5); font-size:13px;">&copy; 2026 GharSetu. All rights reserved.</div>'
    + '</div></footer>';

  function inject() {
    if (!document.getElementById('gs-public-chrome-style')) {
      var st = document.createElement('style');
      st.id = 'gs-public-chrome-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    var navSlot = document.getElementById('gs-public-nav');
    if (navSlot) navSlot.outerHTML = NAV_HTML;
    else if (!document.getElementById('siteNav')) document.body.insertAdjacentHTML('afterbegin', NAV_HTML);

    var footSlot = document.getElementById('gs-public-footer');
    if (footSlot) footSlot.outerHTML = FOOTER_HTML;
    else document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);

    var nav = document.getElementById('siteNav');
    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 60) nav.classList.add('nav-scrolled');
        else nav.classList.remove('nav-scrolled');
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
