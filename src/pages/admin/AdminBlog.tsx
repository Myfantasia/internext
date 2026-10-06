import React, { useEffect, useState } from 'react';
import { Plus, Newspaper, Save } from 'lucide-react';
import { Modal, Field } from './adminUi';
import { useToast } from '../../context/ToastContext';
import { ImageUploadField } from '../../components/admin/ImageUploadField';

interface BlogRow {
  id: string;
  title: string;
  slug: string;
  category?: string;
  author?: string;
  excerpt?: string;
  image?: string;
  imageUrl?: string;
  publishedAt?: string;
  date?: string;
}

export const AdminBlog: React.FC = () => {
  const { showToast } = useToast();
  const [posts, setPosts] = useState<BlogRow[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'Buying Guides',
    author: 'Internext Editorial',
    excerpt: '',
    content: '',
    image: '',
    readTime: '5 min read'
  });

  const load = () => {
    fetch('/api/blog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.posts) setPosts(data.posts);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showToast('Title and article body are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Article published', 'success');
        load();
        setIsModalOpen(false);
        setForm({
          title: '',
          category: 'Buying Guides',
          author: 'Internext Editorial',
          excerpt: '',
          content: '',
          image: '',
          readTime: '5 min read'
        });
      } else {
        showToast(data.message || 'Could not publish article', 'error');
      }
    } catch {
      showToast('Error publishing article', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Blog & Buying Guides</h2>
          <p className="text-xs text-slate-400">Publish storefront articles, product guides, and tech news</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-600/30"
        >
          <Plus className="w-4 h-4" />
          New Article
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
            <tr>
              <th className="p-3.5">Article</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Author</th>
              <th className="p-3.5">Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {posts.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No articles yet
                </td>
              </tr>
            )}
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-slate-800/40">
                <td className="p-3.5">
                  <div className="flex items-center gap-3">
                    {(post.image || post.imageUrl) && (
                      <img src={post.image || post.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <div className="font-bold text-white">{post.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{post.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3.5 text-slate-300">{post.category || '—'}</td>
                <td className="p-3.5 text-slate-300">{post.author || '—'}</td>
                <td className="p-3.5 text-slate-400 font-mono">
                  {post.date || post.publishedAt ? new Date(post.date || post.publishedAt || '').toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <Modal
          title="Publish article"
          onClose={() => setIsModalOpen(false)}
          footer={<>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="blog-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Publishing…' : 'Publish'}</button>
          </>}
        >
          <form id="blog-form" onSubmit={handleCreate} className="space-y-4">
            <Field label="Title" htmlFor="blog-title" required>
              <input id="blog-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="field-input" required />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category" htmlFor="blog-category">
                <select id="blog-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="field-input">
                  <option>Buying Guides</option>
                  <option>Laptop Reviews</option>
                  <option>Technology News</option>
                </select>
              </Field>
              <Field label="Author" htmlFor="blog-author">
                <input id="blog-author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="field-input" />
              </Field>
            </div>
            <ImageUploadField value={form.image} onChange={(url) => setForm({ ...form, image: url })} label="Cover image" />
            <Field label="Excerpt" htmlFor="blog-excerpt" hint="One or two sentences shown on the blog list.">
              <input id="blog-excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className="field-input" />
            </Field>
            <Field label="Article body" htmlFor="blog-content" required>
              <textarea id="blog-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="field-input min-h-48" rows={10} required />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
};
