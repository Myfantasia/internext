import React, { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, MapPin } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { NewsArticle, articleDate } from './NewsPage';

// Original guides render here as plain paragraphs (no HTML is ever injected).
// Aggregated items show only their excerpt and send readers to the publisher.
export const NewsArticlePage: React.FC = () => {
  const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] || '');
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading');

  useEffect(() => {
    fetch(`/api/news/${encodeURIComponent(slug)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (d?.article) { setArticle(d.article); setState('ok'); document.title = `${d.article.title} · Internext`; } else setState('missing');
    }).catch(() => setState('missing'));
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header currentPath="/news" />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <a href="/news" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:underline mb-6"><ArrowLeft className="w-4 h-4" aria-hidden="true" />All news & guides</a>
        {state === 'loading' && <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" aria-label="Loading" />}
        {state === 'missing' && <div className="card card-pad text-center"><h1 className="text-xl font-bold text-white">Article not found</h1><p className="text-sm text-slate-400 mt-2">It may have been unpublished.</p></div>}
        {state === 'ok' && article && (
          <article className="space-y-6">
            <header className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-info">{article.kind === 'guide' ? 'Guide' : 'News'}</span>
                {article.category && <span className="badge badge-neutral">{article.category}</span>}
                {article.county && <span className="badge badge-success"><MapPin className="w-3 h-3" aria-hidden="true" />{article.county}</span>}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">{article.title}</h1>
              <p className="text-sm text-slate-400">{article.author || 'Internext team'} · {articleDate(article).toLocaleDateString('en-KE', { dateStyle: 'long' })}</p>
            </header>
            {article.imageUrl && <img src={article.imageUrl} alt="" className="w-full rounded-3xl border border-slate-800 object-cover max-h-[420px]" referrerPolicy="no-referrer" />}
            {article.summary && <p className="text-lg text-slate-200 leading-relaxed">{article.summary}</p>}
            {article.kind === 'guide' && article.content && (
              <div className="space-y-4 text-base text-slate-300 leading-relaxed">
                {article.content.split(/\n{2,}/).map((para, i) => (
                  /^#{1,3}\s/.test(para)
                    ? <h2 key={i} className="text-xl font-bold text-white pt-2">{para.replace(/^#{1,3}\s/, '')}</h2>
                    : <p key={i} className="whitespace-pre-line">{para}</p>
                ))}
              </div>
            )}
            {article.kind === 'aggregated' && article.sourceUrl && (
              <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Read the full story on {article.sourceName} <ExternalLink className="w-4 h-4" aria-hidden="true" /></a>
            )}
            {article.tags?.length > 0 && <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">{article.tags.map((t) => <span key={t} className="badge badge-neutral">#{t}</span>)}</div>}
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};
