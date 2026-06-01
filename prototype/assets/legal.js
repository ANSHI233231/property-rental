/* GharSetu — canonical legal-document content (platform-global, Super-Admin owned).
 * Single source for the public Privacy / Terms pages AND the Super Admin editor.
 * Keep in sync with prototype/super-admin/legal-pages.html.
 */
window.GHARSETU_LEGAL = {
  privacy: {
    title: 'Privacy Policy',
    updated: '27/05/2026',
    sections: [
      { heading: 'Overview', body: 'GharSetu provides property-rental management software to organizations. This policy explains what data we hold, why, and how it is protected. It applies to the GharSetu platform and all organization workspaces hosted on it.' },
      { heading: 'Data we hold', body: 'For each organization we store property, unit, lease, tenant, rent, maintenance and visitor records entered by that organization. For users we store name, email, phone, role and authentication credentials. Passwords are stored only as Argon2id hashes — never in plain text.' },
      { heading: 'How data is isolated', body: 'Each organization’s data is scoped to that organization. Users only see data for the organization and role they belong to. Platform staff access is limited and every action is recorded in an append-only audit log.' },
      { heading: 'Payments', body: 'GharSetu records rent and subscription payments for bookkeeping. We do not process card payments or store card numbers — billing is handled by manual invoice.' },
      { heading: 'Your choices', body: 'Organization administrators can update or deactivate user accounts. Records are retired, not hard-deleted, to preserve the audit trail. For data requests, contact us through the Contact page.' }
    ]
  },
  terms: {
    title: 'Terms of Service',
    updated: '27/05/2026',
    sections: [
      { heading: 'Acceptance', body: 'By registering an organization on GharSetu you agree to these terms on behalf of that organization. The person who signs up must be authorized to bind the organization.' },
      { heading: 'Accounts and roles', body: 'Each user has exactly one role. Admins manage their organization; Property Managers manage assigned properties; Maintenance staff act on assigned requests; Tenants view their own lease. You are responsible for keeping credentials secure.' },
      { heading: 'Subscription and limits', body: 'Each organization is on a subscription plan with active-user and property limits. Exceeding a limit is prevented for new additions; existing records are not removed. Plan changes take effect immediately for new additions.' },
      { heading: 'Acceptable use', body: 'Do not use GharSetu to store unlawful content or to impersonate others. Platform staff may suspend an organization that violates these terms; suspension locks users out until reactivated.' },
      { heading: 'Liability', body: 'GharSetu is provided on an as-is basis. We maintain reasonable safeguards but are not liable for losses arising from misuse, third-party outages, or data entered incorrectly by an organization.' }
    ]
  }
};

/* Minimal, safe Markdown → HTML for legal body text.
 * Supports: paragraphs (blank-line separated), bullet lists (- / *),
 * **bold**, *italic*, [text](url), and single line breaks. HTML is escaped first. */
window.GHARSETU_mdToHtml = function (md) {
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function inline(s){
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s]+\.html)\)/g, '<a href="$2" style="color:var(--color-royal-blue)">$1</a>');
  }
  var blocks = (md || '').split(/\n{2,}/);
  var out = [];
  blocks.forEach(function (b) {
    var lines = b.split('\n');
    var isList = lines.every(function (l) { return /^\s*[-*]\s+/.test(l) || l.trim() === ''; }) && /[-*]\s+/.test(b);
    if (isList) {
      var items = lines.filter(function (l) { return l.trim(); })
        .map(function (l) { return '<li style="margin:2px 0;">' + inline(l.replace(/^\s*[-*]\s+/, '')) + '</li>'; }).join('');
      out.push('<ul style="margin:8px 0 0;padding-left:20px;font-size:15px;line-height:1.7;color:var(--color-charcoal);">' + items + '</ul>');
    } else {
      out.push('<p style="font-size:15px;line-height:1.7;color:var(--color-charcoal);margin:0;">' + inline(b).replace(/\n/g, '<br>') + '</p>');
    }
  });
  return out.join('');
};

/* Render a legal document into a container (public pages). */
window.renderLegalDoc = function (key, containerId) {
  var doc = window.GHARSETU_LEGAL[key];
  var el = document.getElementById(containerId);
  if (!doc || !el) return;
  var s = doc.sections;
  var ICON = '<span class="legal-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"/></svg></span>';
  function body(sec) { return '<div class="legal-body">' + window.GHARSETU_mdToHtml(sec.body) + '</div>'; }
  function card(sec, cls, feat) {
    return '<section class="legal-card ' + (cls || '') + '">'
      +   '<h2>' + ICON + '<span>' + sec.heading + '</span></h2>'
      +   body(sec)
      +   (feat ? '<div class="legal-feat-panel" aria-hidden="true"></div>' : '')
      + '</section>';
  }

  /* Bento: featured Overview (col-8) · two stacked on the right (col-4) ·
     two on the bottom row (col-6 each) · any extras full-width. */
  var bento = '<div class="legal-bento">';
  if (s[0]) bento += card(s[0], 'feat legal-col-8', true);
  if (s[1] || s[2]) {
    bento += '<div class="legal-right">';
    if (s[1]) bento += card(s[1], 'accent-blue');
    if (s[2]) bento += card(s[2], 'accent-slate');
    bento += '</div>';
  }
  if (s[3]) bento += card(s[3], 'legal-col-6');
  if (s[4]) bento += card(s[4], 'accent-blue legal-col-6');
  for (var i = 5; i < s.length; i++) {
    bento += card(s[i], (i % 2 ? 'accent-blue' : '') + ' legal-col-12');
  }
  bento += '</div>';

  /* Trust strip — cross-links to the sibling legal doc + Contact. */
  var sibling = key === 'privacy' ? 'terms.html' : 'privacy.html';
  var siblingLabel = key === 'privacy' ? 'Read our Terms' : 'Read our Privacy Policy';
  var strip = '<div class="legal-strip">'
    + '<div class="legal-strip-l">'
    +   '<span class="legal-strip-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>'
    +   '<div><h3>Bank-Grade Security</h3><p>Your data is scoped per organization, encrypted in transit, and every change is written to an append-only audit log.</p></div>'
    + '</div>'
    + '<div class="legal-strip-actions">'
    +   '<a class="legal-strip-ghost" href="' + sibling + '">' + siblingLabel + '</a>'
    +   '<a class="legal-strip-cta" href="contact.html">Contact support</a>'
    + '</div>'
    + '</div>';

  el.innerHTML = '<p class="muted" style="font-size:13px;text-align:center;margin:0 0 28px;">Last updated ' + doc.updated + '</p>'
    + bento + strip;
};
