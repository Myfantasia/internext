import Parser from 'rss-parser';
import dns from 'dns/promises';
import net from 'net';
import { KENYA_COUNTIES } from './location.js';

// RSS/Atom aggregation. We keep only what a link preview would show —
// headline, a short excerpt, date, author and an image URL — plus a link back
// to the publisher. Full article bodies are never stored or republished.

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_EXCERPT = 320;
const parser = new Parser({ timeout: 15000, customFields: { item: [['media:content', 'mediaContent'], ['media:thumbnail', 'mediaThumbnail']] } });

// --- SSRF protection: admins enter feed URLs, the server fetches them. -------
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('ff');
}

export async function assertPublicHttpUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Not a valid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) feed URLs are allowed');
  if (url.username || url.password) throw new Error('Feed URLs must not contain credentials');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Feed host is not a public internet address');
  return url;
}

async function fetchFeedXml(feedUrl) {
  let current = feedUrl;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHttpUrl(current);
    const res = await fetch(current, {
      redirect: 'manual',
      headers: { 'User-Agent': 'InternextNewsBot/1.0 (+headline aggregation with links to source)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(15000)
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Feed responded with HTTP ${res.status}`);
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_FEED_BYTES) throw new Error('Feed is too large');
    const text = await res.text();
    if (text.length > MAX_FEED_BYTES) throw new Error('Feed is too large');
    return text;
  }
  throw new Error('Too many redirects');
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function excerpt(text) {
  const clean = stripHtml(text);
  if (clean.length <= MAX_EXCERPT) return clean;
  return `${clean.slice(0, MAX_EXCERPT).replace(/\s+\S*$/, '')}…`;
}

function safeLink(link) {
  try {
    const u = new URL(link);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

function imageFor(item) {
  const candidates = [item.enclosure?.url, item.mediaContent?.$?.url, item.mediaThumbnail?.$?.url];
  return candidates.map(safeLink).find((u) => u && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) || candidates.map(safeLink).find(Boolean) || null;
}

// Tags an article with a county when one is named in the headline/excerpt.
const COUNTY_PATTERNS = KENYA_COUNTIES.map((c) => ({
  name: c.name,
  re: new RegExp(`\\b(${[c.name, c.hq].filter((v, i, a) => a.indexOf(v) === i).map((v) => v.replace(/[-'/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'i')
}));
export function detectCounty(text) {
  const hit = COUNTY_PATTERNS.find((p) => p.re.test(text));
  return hit ? hit.name : null;
}

export async function fetchFeed(source) {
  const xml = await fetchFeedXml(source.feedUrl);
  const feed = await parser.parseString(xml);
  return (feed.items || []).slice(0, 50).map((item) => {
    const link = safeLink(item.link);
    const title = stripHtml(item.title).slice(0, 300);
    const summary = excerpt(item.contentSnippet || item.summary || item.content || '');
    return link && title ? {
      title,
      summary,
      sourceUrl: link,
      author: stripHtml(item.creator || item.author || '').slice(0, 120) || null,
      imageUrl: imageFor(item),
      originalPublishedAt: item.isoDate ? new Date(item.isoDate) : null,
      county: source.defaultCounty || detectCounty(`${title} ${summary}`),
      category: source.defaultCategory || null,
      tags: (item.categories || []).filter((c) => typeof c === 'string').slice(0, 6).map((c) => c.slice(0, 40))
    } : null;
  }).filter(Boolean);
}
