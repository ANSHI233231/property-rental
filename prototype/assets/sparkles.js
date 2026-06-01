/* GharSetu — sparkles "magic text" effect (vanilla, shared).
 * Adds gently twinkling brand-coloured stars around any element tagged
 * `class="sparkle-text"`. Colours come from an optional `data-sparkle`
 * attribute ("#hex,#hex"); default is saffron + royal-blue.
 *
 * Usage:
 *   <h1 class="sparkle-text" data-sparkle="#FF6F00,#1565C0">Contact us</h1>
 *   <script src="assets/sparkles.js"></script>
 *
 * Styles live in assets/styles.css (.sparkle-host / .sparkle / gs-sparkle).
 * Reduced-motion → effect is skipped (CSS also hides .sparkle as a backstop).
 */
(function () {
  var STAR = 'M10.5 0 L12.8 8.2 L21 10.5 L12.8 12.8 L10.5 21 L8.2 12.8 L0 10.5 L8.2 8.2 Z';
  var NS = 'http://www.w3.org/2000/svg';
  function rnd(a, b) { return Math.random() * (b - a) + a; }

  function decorate(h) {
    if (h.querySelector(':scope > .sparkle-host')) return; /* already done */
    var colors = (h.getAttribute('data-sparkle') || '#FF6F00,#1565C0').split(',');
    var host = document.createElement('span');
    host.className = 'sparkle-host';
    host.innerHTML = h.innerHTML;
    h.innerHTML = '';
    h.appendChild(host);

    function place(svg, path) {
      svg.style.left = rnd(-4, 100) + '%';
      svg.style.top = rnd(-10, 100) + '%';
      svg.style.setProperty('--s', rnd(0.4, 1.1).toFixed(2));
      path.setAttribute('fill', Math.random() > 0.5 ? colors[0] : (colors[1] || colors[0]));
    }

    var sparkles = [];
    var count = parseInt(h.getAttribute('data-sparkle-count'), 10) || 7;
    for (var i = 0; i < count; i++) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'sparkle');
      svg.setAttribute('viewBox', '0 0 21 21');
      svg.setAttribute('width', '15'); svg.setAttribute('height', '15');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.animation = 'gs-sparkle ' + rnd(0.7, 1.0).toFixed(2) + 's ease-in-out infinite';
      svg.style.animationDelay = rnd(0, 2).toFixed(2) + 's';
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', STAR);
      svg.appendChild(path);
      host.appendChild(svg);
      place(svg, path);
      sparkles.push({ svg: svg, path: path });
    }
    setInterval(function () {
      var s = sparkles[Math.floor(Math.random() * sparkles.length)];
      place(s.svg, s.path);
    }, 1300);
  }

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelectorAll('.sparkle-text').forEach(decorate);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Expose for pages that build headings dynamically (e.g. after char-reveal). */
  window.gsSparkleDecorate = decorate;
})();
