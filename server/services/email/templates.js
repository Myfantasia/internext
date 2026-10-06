// Branded email layout. Everything visual is configurable through environment
// variables (see .env.example → "Email branding"), so the look can change
// without touching code:
//   EMAIL_BRAND_NAME, EMAIL_BRAND_TAGLINE, EMAIL_BRAND_COLOR, EMAIL_ACCENT_COLOR,
//   EMAIL_LOGO_URL, EMAIL_FOOTER_ADDRESS, EMAIL_FOOTER_CONTACT, EMAIL_SUPPORT_URL
// Email clients ignore <style> blocks and modern CSS, so styles are inline and
// the layout is a single 600px table.

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function brand() {
  return {
    name: process.env.EMAIL_BRAND_NAME || 'Internext Business System',
    tagline: process.env.EMAIL_BRAND_TAGLINE || 'We Make Technology Happen',
    color: process.env.EMAIL_BRAND_COLOR || '#1f4d3a',
    accent: process.env.EMAIL_ACCENT_COLOR || '#2f7a57',
    logoUrl: process.env.EMAIL_LOGO_URL || '',
    address: process.env.EMAIL_FOOTER_ADDRESS || 'Princely House, 1st Floor, Moi Avenue, Nairobi · P.O. Box 16806-00100',
    contact: process.env.EMAIL_FOOTER_CONTACT || '+254 722 664 457 · info@internextbusinesssystem.co.ke',
    supportUrl: process.env.EMAIL_SUPPORT_URL || `${(process.env.APP_URL || '').split(',')[0].trim()}/contact`
  };
}

// A bulletproof-ish button that renders in Outlook, Gmail and Apple Mail.
export function button(label, url) {
  const b = brand();
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
      <tr><td style="border-radius:10px;background:${b.accent};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 26px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;font-size:12px;color:#64748b;">If the button does not work, copy this link into your browser:<br/><span style="word-break:break-all;color:#334155;">${escapeHtml(url)}</span></p>`;
}

export function paragraph(html) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#1e293b;">${html}</p>`;
}

export function muted(html) {
  return `<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#64748b;">${html}</p>`;
}

// layout({ preheader, heading, body, footerNote }) → full HTML document.
export function layout({ preheader = '', heading = '', body = '', footerNote = '' }) {
  const b = brand();
  const logo = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name)}" width="160" style="display:block;border:0;max-width:160px;height:auto;" />`
    : `<div style="font-family:Arial,sans-serif;font-size:20px;font-weight:900;color:#ffffff;letter-spacing:.02em;">${escapeHtml(b.name.toUpperCase())}</div>
       <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#cfe5d8;margin-top:4px;">${escapeHtml(b.tagline)}</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="light"/><title>${escapeHtml(heading || b.name)}</title></head>
<body style="margin:0;padding:0;background:#eef2ef;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2ef;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #dbe3dd;">
        <tr><td style="background:${b.color};padding:24px 28px;">${logo}</td></tr>
        <tr><td style="padding:28px;font-family:Arial,sans-serif;">
          ${heading ? `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f172a;">${escapeHtml(heading)}</h1>` : ''}
          ${body}
          ${footerNote ? muted(footerNote) : ''}
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f6f8f6;border-top:1px solid #e3e9e4;font-family:Arial,sans-serif;font-size:11px;line-height:1.6;color:#64748b;text-align:center;">
          <strong style="color:#334155;">${escapeHtml(b.name)}</strong><br/>
          ${escapeHtml(b.address)}<br/>
          ${escapeHtml(b.contact)}${b.supportUrl ? ` · <a href="${escapeHtml(b.supportUrl)}" style="color:${b.accent};">Help centre</a>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Plain-text alternative derived from the HTML (spam filters and accessibility
// both prefer multipart emails that include one).
export function htmlToText(html) {
  return String(html)
    .replace(/<span style="display:none[^>]*>.*?<\/span>/s, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs, '$2 ($1)')
    .replace(/<(br|\/p|\/h1|\/tr|\/li)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, ' - ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, '·')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
