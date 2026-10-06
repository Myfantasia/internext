import React, { useState } from 'react';
import { Plus, Award, Save } from 'lucide-react';
import { Modal, Field } from './adminUi';
import { useStore } from '../../context/StoreContext';
import { useToast } from '../../context/ToastContext';
import { ImageUploadField } from '../../components/admin/ImageUploadField';

export const AdminBrands: React.FC = () => {
  const { brands, refreshCatalog } = useStore();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Brand name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), logoUrl })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Brand ${data.brand.name} created`, 'success');
        await refreshCatalog();
        setName('');
        setLogoUrl('');
        setIsModalOpen(false);
      } else {
        showToast(data.message || 'Could not create brand', 'error');
      }
    } catch {
      showToast('Error creating brand', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Brands</h2>
          <p className="text-xs text-slate-400">Manufacturer roster shown on the storefront and product forms</p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-600/30"
        >
          <Plus className="w-4 h-4" />
          Add Brand
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {brands.map((b) => {
          const logo = b.logo || (b as { logoUrl?: string }).logoUrl;
          return (
            <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-2">
                {logo ? (
                  <img src={logo} alt="" className="max-w-full max-h-full object-contain" />
                ) : (
                  <Award className="w-6 h-6 text-slate-600" />
                )}
              </div>
              <div>
                <div className="text-sm font-bold text-white">{b.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{b.count} SKUs</div>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <Modal
          title="New brand"
          size="medium"
          onClose={() => setIsModalOpen(false)}
          footer={<>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" form="brand-form" disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save brand'}</button>
          </>}
        >
          <form id="brand-form" onSubmit={handleCreate} className="space-y-4">
            <Field label="Brand name" htmlFor="brand-name" required>
              <input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} className="field-input" required />
            </Field>
            <ImageUploadField value={logoUrl} onChange={setLogoUrl} label="Logo (optional)" />
          </form>
        </Modal>
      )}
    </div>
  );
};
