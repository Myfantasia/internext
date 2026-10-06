import React, { useEffect, useState } from 'react';
import { Newspaper, Plus, Pencil, Trash2, Rss, RefreshCw, Star, ExternalLink, Send, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { KENYA_COUNTIES } from '../../data/kenyaCounties';
import { api, PageHeader, Modal, Field, Toggle, StatusBadge, LoadingBlock, EmptyState, toLocalInput, fromLocalInput, fmtDateTime } from './adminUi';
import { ImageUploadField } from '../../components/admin/ImageUploadField';

interface Article {
  id: string; kind: 'aggregated' | 'guide'; title: string; slug: string; summary: string | null; content?: string | null; author: string | null;
  imageUrl: string | null; category: string | null; county: string | null; tags: string[]; sourceName: string | null; sourceUrl: string | null;
  status: 'draft' | 'published' | 'archived'; scheduled: boolean; publishAt: string | null; isFeatured: boolean; originalPublishedAt: string | null; createdAt: string;
}
interface Source { id: string; name: string; feedUrl: string; siteUrl: string | null; description: string | null; defaultCategory: string | null; defaultCounty: string | null; isActive: boolean; lastFetchedAt: string | null; lastError: string | null; articleCount: number }

const CATEGORIES = ['Kenya Tech', 'Business & Startups', 'Mobile & Telecoms', 'Fintech & M-Pesa', 'Government & Policy', 'Cybersecurity', 'Devices & Reviews', 'Global Tech', 'How-to Guides', 'Buying Guides'];
const blankArticle = () => ({ title: '', summary: '', content: '', author: '', imageUrl: '', category: 'How-to Guides', county: '', tags: '', status: 'draft' as Article['status'], publishAt: '', isFeatured: false });
const blankSource = () => ({ name: '', feedUrl: '', siteUrl: '', description: '', defaultCategory: 'Kenya Tech', defaultCounty: '', isActive: true });

export const AdminNews: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'review' | 'published' | 'guides' | 'sources'>('review');
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [editing, setEditing] = useState<{ article: Article | null; form: ReturnType<typeof blankArticle> } | null>(null);
  const [sourceForm, setSourceForm] = useState<{ id?: string; form: ReturnType<typeof blankSource> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);

  const loadArticles = () => {
    const qs = tab === 'review' ? '?status=draft&kind=aggregated' : tab === 'published' ? '?status=published' : tab === 'guides' ? '?kind=guide' : '';
    setArticles(null);
    api<{ articles: Article[] }>(`/api/news/admin/articles${qs}`).then((d) => setArticles(d.articles)).catch((e) => showToast(e.message, 'error'));
  };
  const loadSources = () => api<{ sources: Source[] }>('/api/news/admin/sources').then((d) => setSources(d.sources)).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { if (tab === 'sources') loadSources(); else loadArticles(); }, [tab]);

  const openArticle = (a: Article | null) => setEditing({
    article: a,
    form: a ? { title: a.title, summary: a.summary || '', content: a.content || '', author: a.author || '', imageUrl: a.imageUrl || '', category: a.category || '', county: a.county || '', tags: (a.tags || []).join(', '), status: a.status, publishAt: toLocalInput(a.publishAt), isFeatured: a.isFeatured } : blankArticle()
  });

  const saveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const f = editing.form;
    const body: any = {
      title: f.title, summary: f.summary || null, author: f.author || null, imageUrl: f.imageUrl || null, category: f.category || null,
      county: f.county || null, tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), status: f.status, publishAt: fromLocalInput(f.publishAt), isFeatured: f.isFeatured
    };
    if (!editing.article || editing.article.kind === 'guide') body.content = f.content;
    try {
      await api(editing.article ? `/api/news/admin/articles/${editing.article.id}` : '/api/news/admin/articles', { method: editing.article ? 'PUT' : 'POST', body });
      showToast('Saved', 'success');
      setEditing(null);
      loadArticles();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };

  const quick = async (a: Article, patch: Partial<Article>, message: string) => {
    try { await api(`/api/news/admin/articles/${a.id}`, { method: 'PUT', body: patch }); showToast(message, 'success'); loadArticles(); }
    catch (err) { showToast((err as Error).message, 'error'); }
  };
  const removeArticle = async (a: Article) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api(`/api/news/admin/articles/${a.id}`, { method: 'DELETE' }); loadArticles(); } catch (err) { showToast((err as Error).message, 'error'); }
  };

  const saveSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceForm) return;
    setSaving(true);
    const f = sourceForm.form;
    try {
      await api(sourceForm.id ? `/api/news/admin/sources/${sourceForm.id}` : '/api/news/admin/sources', {
        method: sourceForm.id ? 'PUT' : 'POST',
        body: { ...f, siteUrl: f.siteUrl || null, defaultCounty: f.defaultCounty || null, defaultCategory: f.defaultCategory || null, description: f.description || null }
      });
      showToast('Source saved', 'success');
      setSourceForm(null);
      loadSources();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };
  const fetchSource = async (id: string | 'all') => {
    setFetching(id);
    try {
      if (id === 'all') {
        const d = await api<{ results: { source: string; added?: number; error?: string }[] }>('/api/news/admin/fetch-all', { method: 'POST' });
        showToast(d.results.map((r) => `${r.source}: ${r.error ? 'failed' : `${r.added} new`}`).join(' · ') || 'No active sources', 'info');
      } else {
        const d = await api<{ message: string }>(`/api/news/admin/sources/${id}/fetch`, { method: 'POST' });
        showToast(d.message, 'success');
      }
      loadSources();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setFetching(null); }
  };
  const removeSource = async (s: Source) => {
    if (!window.confirm(`Remove source "${s.name}"? Imported articles are kept.`)) return;
    try { await api(`/api/news/admin/sources/${s.id}`, { method: 'DELETE' }); loadSources(); } catch (err) { showToast((err as Error).message, 'error'); }
  };

  const setF = (patch: Partial<ReturnType<typeof blankArticle>>) => editing && setEditing({ ...editing, form: { ...editing.form, ...patch } });
  const isAggregated = editing?.article?.kind === 'aggregated';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <PageHeader
        icon={Newspaper}
        title="Tech news & guides"
        description="Imported news stores only the headline, a short excerpt and a link to the publisher — never the full article. Review imported items, tag them by county and topic, then publish. Write original guides here too."
        actions={<>
          <button type="button" onClick={() => openArticle(null)} className="btn btn-primary"><Plus className="w-4 h-4" />Write a guide</button>
          <button type="button" onClick={() => { setTab('sources'); setSourceForm({ form: blankSource() }); }} className="btn btn-secondary"><Rss className="w-4 h-4" />Add feed</button>
        </>}
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist">
        {([['review', 'Review queue'], ['published', 'Published'], ['guides', 'Guides'], ['sources', 'Feed sources']] as const).map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`btn btn-sm shrink-0 ${tab === v ? 'btn-primary' : 'btn-secondary'}`}>{l}</button>
        ))}
      </div>

      {tab !== 'sources' && (!articles ? <LoadingBlock /> : articles.length === 0 ? (
        <EmptyState title={tab === 'review' ? 'Nothing to review' : 'Nothing here yet'} text={tab === 'review' ? 'Add RSS feeds under "Feed sources" and fetch them; new items land here as drafts.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {articles.map((a) => (
            <li key={a.id} className="card p-4 sm:p-5 flex flex-col md:flex-row gap-4">
              {a.imageUrl && <img src={a.imageUrl} alt="" className="w-full md:w-40 h-32 md:h-24 object-cover rounded-xl border border-slate-800 shrink-0" loading="lazy" referrerPolicy="no-referrer" />}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge state={a.scheduled ? 'scheduled' : a.status} />
                  <span className="badge badge-neutral">{a.kind === 'guide' ? 'Guide' : a.sourceName || 'News'}</span>
                  {a.category && <span className="badge badge-info">{a.category}</span>}
                  {a.county && <span className="badge badge-success">{a.county}</span>}
                  {a.isFeatured && <span className="badge badge-warning"><Star className="w-3 h-3" />Featured</span>}
                </div>
                <p className="font-semibold text-white">{a.title}</p>
                {a.summary && <p className="text-sm text-slate-400 line-clamp-2">{a.summary}</p>}
                <p className="text-xs text-slate-500">{a.scheduled ? `Publishes ${fmtDateTime(a.publishAt)}` : `Added ${fmtDateTime(a.createdAt)}`}{a.sourceUrl && <> · <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">source <ExternalLink className="w-3 h-3" /></a></>}</p>
              </div>
              <div className="flex md:flex-col gap-2 shrink-0 flex-wrap">
                {a.status !== 'published' && <button type="button" onClick={() => quick(a, { status: 'published' }, 'Published')} className="btn btn-primary btn-sm"><Send className="w-4 h-4" />Publish</button>}
                {a.status === 'published' && <button type="button" onClick={() => quick(a, { status: 'draft' }, 'Unpublished')} className="btn btn-secondary btn-sm"><EyeOff className="w-4 h-4" />Unpublish</button>}
                <button type="button" onClick={() => quick(a, { isFeatured: !a.isFeatured }, a.isFeatured ? 'Unfeatured' : 'Featured')} className="btn btn-ghost btn-sm"><Star className="w-4 h-4" />{a.isFeatured ? 'Unfeature' : 'Feature'}</button>
                <button type="button" onClick={() => openArticle(a)} className="btn btn-ghost btn-sm"><Pencil className="w-4 h-4" />Edit</button>
                <button type="button" onClick={() => removeArticle(a)} className="btn btn-ghost btn-sm"><Trash2 className="w-4 h-4" />Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === 'sources' && (!sources ? <LoadingBlock /> : (
        <div className="space-y-4">
          <div className="callout callout-info">
            <span>Only add feeds you are permitted to use. Most publishers offer RSS for exactly this — headlines with links back. Respect each site's terms; we never store full article text.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSourceForm({ form: blankSource() })} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add feed</button>
            <button type="button" onClick={() => fetchSource('all')} disabled={!!fetching || !sources.length} className="btn btn-secondary btn-sm">{fetching === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}Fetch all now</button>
          </div>
          {sources.length === 0 ? <EmptyState title="No feeds yet" text="Add the RSS URL of a technology news site to start importing headlines." /> : (
            <div className="card overflow-hidden"><div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Source</th><th>Defaults</th><th>Last fetch</th><th>Items</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                <tbody>{sources.map((s) => (
                  <tr key={s.id}>
                    <td className="min-w-[200px]"><div className="font-semibold text-white">{s.name}</div><div className="text-xs text-slate-400 break-all">{s.feedUrl}</div></td>
                    <td className="text-xs">{s.defaultCategory || '—'}<br />{s.defaultCounty || 'Auto-detect county'}</td>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(s.lastFetchedAt)}{s.lastError && <div className="text-rose-400 max-w-[220px] whitespace-normal">{s.lastError}</div>}</td>
                    <td>{s.articleCount}</td>
                    <td><StatusBadge state={s.isActive ? 'active' : 'inactive'} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" className="icon-button" disabled={!!fetching} onClick={() => fetchSource(s.id)} aria-label={`Fetch ${s.name} now`} title="Fetch now">{fetching === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</button>
                      <button type="button" className="icon-button" onClick={() => setSourceForm({ id: s.id, form: { name: s.name, feedUrl: s.feedUrl, siteUrl: s.siteUrl || '', description: s.description || '', defaultCategory: s.defaultCategory || '', defaultCounty: s.defaultCounty || '', isActive: s.isActive } })} aria-label={`Edit ${s.name}`}><Pencil className="w-4 h-4" /></button>
                      <button type="button" className="icon-button" onClick={() => removeSource(s)} aria-label={`Remove ${s.name}`}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div></div>
          )}
        </div>
      ))}

      {editing && (
        <Modal title={editing.article ? (isAggregated ? 'Edit imported item' : 'Edit guide') : 'Write a guide'} description={isAggregated ? 'You can adjust the headline, excerpt and tags. The body stays on the publisher\'s site.' : undefined} onClose={() => setEditing(null)}
          footer={<><button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">Cancel</button><button type="submit" form="article-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save'}</button></>}>
          <form id="article-form" onSubmit={saveArticle} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              <Field label="Title" htmlFor="a-title" required><input id="a-title" value={editing.form.title} onChange={(e) => setF({ title: e.target.value })} className="field-input" maxLength={300} required /></Field>
              <Field label={isAggregated ? 'Excerpt' : 'Summary'} htmlFor="a-sum" hint="1–2 sentences shown on cards and at the top of the page."><textarea id="a-sum" rows={3} value={editing.form.summary} onChange={(e) => setF({ summary: e.target.value })} className="field-input" maxLength={600} /></Field>
              {!isAggregated && (
                <Field label="Guide content" htmlFor="a-body" required hint="Plain text. Leave a blank line between paragraphs; start a line with ## for a sub-heading.">
                  <textarea id="a-body" rows={14} value={editing.form.content} onChange={(e) => setF({ content: e.target.value })} className="field-input font-[inherit] leading-relaxed" required />
                </Field>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Status" htmlFor="a-status"><select id="a-status" value={editing.form.status} onChange={(e) => setF({ status: e.target.value as any })} className="field-input"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></Field>
              <Field label="Publish at" htmlFor="a-at" hint="Optional. With status Published and a future time, the article is scheduled."><input id="a-at" type="datetime-local" value={editing.form.publishAt} onChange={(e) => setF({ publishAt: e.target.value })} className="field-input" /></Field>
              <Field label="Category" htmlFor="a-cat"><input id="a-cat" list="news-cats" value={editing.form.category} onChange={(e) => setF({ category: e.target.value })} className="field-input" /><datalist id="news-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <Field label="County" htmlFor="a-county" hint="Empty = national / not location-specific."><select id="a-county" value={editing.form.county} onChange={(e) => setF({ county: e.target.value })} className="field-input"><option value="">National</option>{KENYA_COUNTIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}</select></Field>
              <Field label="Tags" htmlFor="a-tags" hint="Comma-separated."><input id="a-tags" value={editing.form.tags} onChange={(e) => setF({ tags: e.target.value })} className="field-input" /></Field>
              {!isAggregated && <Field label="Author" htmlFor="a-author"><input id="a-author" value={editing.form.author} onChange={(e) => setF({ author: e.target.value })} className="field-input" /></Field>}
              {!isAggregated && <ImageUploadField label="Cover image" value={editing.form.imageUrl} onChange={(url: string) => setF({ imageUrl: url })} />}
              <Toggle checked={editing.form.isFeatured} onChange={(v) => setF({ isFeatured: v })} label="Featured" description="Shown first on the news page." />
            </div>
          </form>
        </Modal>
      )}

      {sourceForm && (
        <Modal title={sourceForm.id ? 'Edit feed source' : 'Add feed source'} size="medium" onClose={() => setSourceForm(null)}
          footer={<><button type="button" onClick={() => setSourceForm(null)} className="btn btn-secondary">Cancel</button><button type="submit" form="source-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save source'}</button></>}>
          <form id="source-form" onSubmit={saveSource} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" htmlFor="s-name" required><input id="s-name" value={sourceForm.form.name} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, name: e.target.value } })} className="field-input" required /></Field>
            <Field label="Website" htmlFor="s-site"><input id="s-site" type="url" value={sourceForm.form.siteUrl} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, siteUrl: e.target.value } })} className="field-input" placeholder="https://" /></Field>
            <Field label="RSS / Atom feed URL" htmlFor="s-feed" required className="sm:col-span-2"><input id="s-feed" type="url" value={sourceForm.form.feedUrl} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, feedUrl: e.target.value } })} className="field-input" placeholder="https://example.co.ke/feed" required /></Field>
            <Field label="Description" htmlFor="s-desc" className="sm:col-span-2"><input id="s-desc" value={sourceForm.form.description} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, description: e.target.value } })} className="field-input" /></Field>
            <Field label="Default category" htmlFor="s-cat"><input id="s-cat" list="news-cats-2" value={sourceForm.form.defaultCategory} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, defaultCategory: e.target.value } })} className="field-input" /><datalist id="news-cats-2">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Default county" htmlFor="s-county" hint="Empty = detect from each headline."><select id="s-county" value={sourceForm.form.defaultCounty} onChange={(e) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, defaultCounty: e.target.value } })} className="field-input"><option value="">Auto-detect</option>{KENYA_COUNTIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}</select></Field>
            <div className="sm:col-span-2"><Toggle checked={sourceForm.form.isActive} onChange={(v) => setSourceForm({ ...sourceForm, form: { ...sourceForm.form, isActive: v } })} label="Active" description="Inactive sources are skipped by 'Fetch all' and scheduled imports." /></div>
          </form>
        </Modal>
      )}
    </div>
  );
};
