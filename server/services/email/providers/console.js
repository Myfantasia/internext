// Development provider: prints the email instead of sending it. Selected when
// EMAIL_PROVIDER=console (the default when SMTP is not configured).
export async function send({ from, replyTo, to, subject, html, text, attachments }) {
  const links = [...(html?.matchAll(/href="([^"]+)"/g) || [])].map((m) => m[1]);

  console.log('\n[email:console] ------------------------------------------');
  console.log(`[email:console] From: ${from}${replyTo ? ` (reply-to ${replyTo})` : ''}`);
  console.log(`[email:console] To: ${to}`);
  console.log(`[email:console] Subject: ${subject}`);
  console.log(`[email:console] ${(text || '').slice(0, 600)}`);
  if (links.length) console.log(`[email:console] Link(s): ${links.join(', ')}`);
  if (attachments?.length) console.log(`[email:console] Attachments: ${attachments.map((a) => a.filename).join(', ')}`);
  console.log('[email:console] ------------------------------------------\n');
  return { success: true, provider: 'console' };
}

export async function verify() {
  return { success: true, provider: 'console', note: 'Console provider does not send real email.' };
}
