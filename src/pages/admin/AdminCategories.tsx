import React, { useState } from 'react';
import { Plus, FolderTree, Save } from 'lucide-react';
import { Modal, Field } from './adminUi';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { ImageUploadField } from '../../components/admin/ImageUploadField';

export const AdminCategories: React.FC = () => {
  const { categories, refreshCatalog } = useStore();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'product' | 'service'>('product');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setKind('product');
    setDescription('');
    setImageUrl('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), kind, description, imageUrl })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Category ${data.category.name} created`, 'success');
        await refreshCatalog();
        reset();
        setIsModalOpen(false);
      } else {
        showToast(data.message || 'Could not create category', 'error');
      }
    } catch {
      showToast('Error creating category', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Categories</h2>
          <p className="text-xs text-slate-400">Organize products and services that appear in the storefront catalog</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-600/30"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="h-28 bg-slate-950 flex items-center justify-center">
              {c.image || (c as { imageUrl?: string }).imageUrl ? (
                <img src={c.image || (c as { imageUrl?: string }).imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <FolderTree className="w-8 h-8 text-slate-600" />
              )}
            </div>
            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-white text-sm truncate">{c.name}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400">
                  {(c as { kind?: string }).kind || 'product'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{c.description || 'No description'}</p>
              <p className="text-[11px] font-mono text-slate-500">{c.productCount} products</p>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <Modal
          title="New category"
          size="medium"
          onClose={() => setIsModalOpen(false)}
          footer={<>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="category-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save category'}</button>
          </>}
        >
          <form id="category-form" onSubmit={handleCreate} className="space-y-4">
            <Field label="Name" htmlFor="category-name" required>
              <input id="category-name" value={name} onChange={(e) => setName(e.target.value)} className="field-input" required />
            </Field>
            <Field label="Type" htmlFor="category-kind">
              <select id="category-kind" value={kind} onChange={(e) => setKind(e.target.value as 'product' | 'service')} className="field-input">
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
            </Field>
            <Field label="Description" htmlFor="category-description">
              <textarea id="category-description" value={description} onChange={(e) => setDescription(e.target.value)} className="field-input min-h-20" rows={3} />
            </Field>
            <ImageUploadField value={imageUrl} onChange={setImageUrl} label="Cover image (optional)" />
          </form>
        </Modal>
      )}
    </div>
  );
};
