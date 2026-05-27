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
  var html = '<p class="muted" style="font-size:13px;margin:0 0 28px;">Last updated ' + doc.updated + '</p>';
  doc.sections.forEach(function (s) {
    html += '<h2 style="font-size:22px;color:var(--color-royal-blue);margin:28px 0 10px;">' + s.heading + '</h2>'
          + window.GHARSETU_mdToHtml(s.body);
  });
  el.innerHTML = html;
};
