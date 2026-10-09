import React, { useEffect, useState } from 'react';
import { Newspaper, Search, MapPin, ExternalLink, BookOpen, Loader2, Star } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { navigate } from '../utils/navigation';
import { KENYA_COUNTIES } from '../data/kenyaCounties';

export interface NewsArticle {
  id: string;
  kind: 'aggregated' | 'guide';
  title: string;
  slug: string;
  summary?: string | null;
  content?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  county?: string | null;
  tags: string[];
  sourceName?: string | null;
  sourceUrl?: string | null;
  isFeatured: boolean;
  publishAt?: string | null;
  originalPublishedAt?: string | null;
  createdAt: string;
}

export const articleDate = (a: NewsArticle) => new Date(a.publishAt || a.originalPublishedAt || a.createdAt);

// Aggregated items open the publisher's site; guides open our own page.
export const ArticleCard: React.FC<{ article: NewsArticle; large?: boolean }> = ({ article, large = false }) => {
  const external = article.kind === 'aggregated' && article.sourceUrl;
  const href = external ? article.sourceUrl! : `/news/${article.slug}`;
  return (
    <article className={`product-card card overflow-hidden flex flex-col min-w-0 ${large ? 'md:col-span-2 md:flex-row' : ''}`}>
      {article.imageUrl && (
        <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`block bg-slate-950 overflow-hidden ${large ? 'md:w-1/2 aspect-[16/10] md:aspect-auto' : 'aspect-[16/9]'}`} tabIndex={-1} aria-hidden="true">
          <img src={article.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      )}
      <div className="p-5 flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`badge ${article.kind === 'guide' ? 'badge-info' : 'badge-neutral'}`}>{article.kind === 'guide' ? 'Guide' : article.category || 'News'}</span>
          {article.kind === 'guide' && article.category && <span className="badge badge-neutral">{article.category}</span>}
          {article.county && <span className="badge badge-success"><MapPin className="w-3 h-3" aria-hidden="true" />{article.county}</span>}
          {article.isFeatured && <span className="badge badge-warning"><Star className="w-3 h-3" aria-hidden="true" />Featured</span>}
        </div>
        <h3 className={`font-bold text-white leading-snug ${large ? 'text-xl sm:text-2xl' : 'text-base'}`}>
          <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="hover:underline">{article.title}</a>
        </h3>
        {article.summary && <p className={`text-sm text-slate-400 leading-relaxed ${large ? 'line-clamp-4' : 'line-clamp-3'}`}>{article.summary}</p>}
        <div className="mt-auto pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{external ? `Source: ${article.sourceName}` : article.author || 'Internext team'} · {articleDate(article).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
          {external
            ? <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold">Read on {article.sourceName} <ExternalLink className="w-3 h-3" aria-hidden="true" /></span>
            : <span className="inline-flex items-center gap-1 text-cyan-400 font-semibold"><BookOpen className="w-3 h-3" aria-hidden="true" />Read guide</span>}
        </div>
      </div>
    </article>
  );
};

export const NewsPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const [county, setCounty] = useState(params.get('county') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [kind, setKind] = useState(params.get('kind') || '');
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news/facets').then((r) => r.json()).then((d) => setCategories(d.categories || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (county) qs.set('county', county);
    if (category) qs.set('category', category);
    if (kind) qs.set('kind', kind);
    if (q.trim()) qs.set('q', q.trim());
    qs.set('page', String(page));
    qs.set('limit', '12');
    setLoading(true);
    const t = window.setTimeout(() => {
      fetch(`/api/news?${qs}`).then((r) => r.json()).then((d) => {
        setArticles((prev) => (page === 1 ? d.articles || [] : [...prev, ...(d.articles || [])]));
        setTotalPages(d.totalPages || 1);
      }).catch(() => setArticles([])).finally(() => setLoading(false));
      const visible = new URLSearchParams(qs);
      visible.delete('page'); visible.delete('limit');
      window.history.replaceState({}, '', `/news${visible.toString() ? `?${visible}` : ''}`);
    }, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [county, category, kind, q, page]);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => { setPage(1); setter(v); };
  const [lead, ...rest] = articles;

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/news" />
      <section className="aurora-bg border-b border-slate-800 px-4 py-10 sm:py-14">
        <div className="max-w-[1320px] mx-auto space-y-3">
          <div className="eyebrow flex items-center gap-1.5"><Newspaper className="w-4 h-4" aria-hidden="true" />Tech News & Guides</div>
          <h1 className="text-3xl sm:text-4xl font-black text-white max-w-2xl">Technology news from Kenya and beyond, plus practical guides</h1>
          <p className="text-sm text-slate-400 max-w-2xl">Headlines link to the original publishers. Guides are written by the Internext team.</p>
        </div>
      </section>

      <main className="flex-1 max-w-[1320px] mx-auto w-full px-4 py-8 space-y-6">
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor="news-q" className="sr-only">Search news</label>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="news-q" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Search headlines" className="field-input pl-10" />
          </div>
          <div>
            <label htmlFor="news-county" className="sr-only">County</label>
            <select id="news-county" value={county} onChange={(e) => resetPage(setCounty)(e.target.value)} className="field-input">
              <option value="">All of Kenya</option>
              {KENYA_COUNTIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="news-cat" className="sr-only">Category</label>
            <select id="news-cat" value={category} onChange={(e) => resetPage(setCategory)(e.target.value)} className="field-input">
              <option value="">All topics</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
          </div>
          <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1 text-sm font-semibold" role="group" aria-label="Content type">
            {[['', 'All'], ['aggregated', 'News'], ['guide', 'Guides']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={kind === v} onClick={() => resetPage(setKind)(v)} className={`flex-1 rounded-lg py-2 ${kind === v ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-100'}`}>{l}</button>
            ))}
          </div>
        </div>

        {county && <p className="text-sm text-slate-400">Showing stories tagged <strong className="text-white">{county}</strong>, plus national stories.</p>}

        {loading && page === 1 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-72 rounded-3xl" />)}</div>
        ) : articles.length === 0 ? (
          <div className="card card-pad text-center space-y-2">
            <Newspaper className="w-8 h-8 mx-auto text-slate-500" aria-hidden="true" />
            <p className="text-slate-300 font-semibold">No stories match these filters yet.</p>
            <button type="button" onClick={() => { setCounty(''); setCategory(''); setKind(''); setQ(''); setPage(1); }} className="btn btn-secondary btn-sm">Clear filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lead && <ArticleCard article={lead} large />}
            {rest.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        )}

        {page < totalPages && (
          <div className="text-center">
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={loading} className="btn btn-secondary">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}Load more
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

