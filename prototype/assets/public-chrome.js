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
 */
(function () {
  var CSS = [
    '#siteNav { transition: background 250ms ease, border-color 250ms ease, box-shadow 250ms ease; }',
    '.site-logo { color: var(--color-navy); transition: color 250ms ease; }',
    '.logo-accent { color: var(--color-saffron); }',
    '.nav-login { color: var(--color-royal-blue); transition: color 250ms ease; }',
    '.nav-scrolled { background: rgba(26,35,126,0.85) !important; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);',
    '  border-bottom-color: rgba(255,255,255,0.10) !important; box-shadow: 0 4px 24px rgba(0,0,0,0.18); }',
    '.nav-scrolled .site-logo { color: #fff; }',
    '.nav-scrolled .nav-login { color: #fff; }',
    '.gs-footer { background:#0D1757; padding:44px 0 32px; border-top:1px solid rgba(255,255,255,0.10); }',
    '@media (max-width:1023px){ .nav-register { display:none; } }',
    '@media (prefers-reduced-motion: reduce){ #siteNav, .site-logo, .nav-login { transition:none; } }'
  ].join('\n');

  var NAV_HTML =
    '<nav id="siteNav" style="background:#fff; border-bottom:1px solid #CFD8DC; position:sticky; top:0; z-index:40;">'
    + '<div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">'
    + '<a href="index.html" class="site-logo font-poppins font-bold text-2xl tracking-wide" style="text-decoration:none;">Ghar<span class="logo-accent">Setu</span></a>'
    + '<div class="flex items-center" style="gap:22px;">'
    + '<a href="login.html" class="nav-login font-poppins font-semibold text-sm" style="text-decoration:none;">Login</a>'
    + '<a href="organization-signup.html" class="btn btn-primary nav-register" style="font-size:13px; padding:8px 18px;">Register</a>'
    + '</div></div></nav>';

  function footLink(href, label) {
    return '<li><a href="' + href + '" class="font-poppins" style="color:rgba(255,255,255,0.65); font-size:14px; text-decoration:none; transition:color 150ms;"'
      + ' onmouseover="this.style.color=\'#fff\'" onmouseout="this.style.color=\'rgba(255,255,255,0.65)\'">' + label + '</a></li>';
  }

  var FOOTER_HTML =
    '<footer class="gs-footer">'
    + '<div class="max-w-6xl mx-auto px-6">'
    + '<div style="display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:32px; margin-bottom:32px;">'
    + '<div>'
    + '<a href="index.html" class="font-poppins font-bold" style="font-size:22px; color:#fff; text-decoration:none; letter-spacing:0.5px;">Ghar<span style="color:#FF6F00;">Setu</span></a>'
    + '<p style="color:rgba(255,255,255,0.65); font-size:14px; margin-top:8px; max-width:220px; line-height:1.6;">Multi-tenant property rental management — organized, role-scoped, auditable.</p>'
    + '</div>'
    + '<div style="display:flex; gap:48px; flex-wrap:wrap;">'
    + '<div>'
    + '<div class="font-poppins font-semibold" style="color:rgba(255,255,255,0.85); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Company</div>'
    + '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">' + footLink('contact.html', 'Contact') + '</ul>'
    + '</div>'
    + '<div>'
    + '<div class="font-poppins font-semibold" style="color:rgba(255,255,255,0.85); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px;">Legal</div>'
    + '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">' + footLink('privacy.html', 'Privacy') + footLink('terms.html', 'Terms') + '</ul>'
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
