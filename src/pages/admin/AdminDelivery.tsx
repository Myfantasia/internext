import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Truck, Plus, Pencil, Trash2, MapPin, Save, Calculator, Store } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { api, PageHeader, Modal, Field, Toggle, StatusBadge, LoadingBlock, kes } from './adminUi';
import { KENYA_COUNTIES } from '../../data/kenyaCounties';

const MapPinPicker = lazy(() => import('../../components/location/MapPinPicker'));

interface Band { id: string; name: string; description: string | null; minKm: number; maxKm: number | null; fee: number; freeThreshold: number | null; estimatedTime: string | null; isActive: boolean; sortOrder: number }
interface Option { id: string; name: string; kind: 'pickup' | 'fixed'; description: string | null; fee: number; freeThreshold: number | null; estimatedTime: string | null; isActive: boolean; sortOrder: number }
interface Config { office: { lat: number; lng: number } | null; roadDistanceFactor: number; outOfRangeFee: number | null; bands: Band[]; options: Option[] }

const blankBand = (minKm = 0): Omit<Band, 'id'> => ({ name: '', description: '', minKm, maxKm: null, fee: 0, freeThreshold: null, estimatedTime: '', isActive: true, sortOrder: 0 });
const blankOption = (): Omit<Option, 'id'> => ({ name: '', kind: 'fixed', description: '', fee: 0, freeThreshold: null, estimatedTime: '', isActive: true, sortOrder: 0 });
const numOrNull = (v: string) => (v === '' ? null : Number(v));

export const AdminDelivery: React.FC = () => {
  const { showToast } = useToast();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [settings, setSettings] = useState({ officeLat: -1.2833, officeLng: 36.825, roadDistanceFactor: 1.3, outOfRangeFee: null as number | null });
  const [savingSettings, setSavingSettings] = useState(false);
  const [bandForm, setBandForm] = useState<{ id?: string; data: Omit<Band, 'id'> } | null>(null);
  const [optionForm, setOptionForm] = useState<{ id?: string; data: Omit<Option, 'id'> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tester, setTester] = useState({ county: 'Nairobi', lat: '', lng: '', subtotal: 20000 });
  const [testResult, setTestResult] = useState<string>('');

  const load = () => api<Config & { success: boolean }>('/api/delivery/admin').then((d) => {
    setCfg(d);
    if (d.office) setSettings({ officeLat: d.office.lat, officeLng: d.office.lng, roadDistanceFactor: d.roadDistanceFactor, outOfRangeFee: d.outOfRangeFee });
  }).catch((e) => showToast(e.message, 'error'));
  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    setSavingSettings(true);
    try { await api('/api/delivery/admin/settings', { method: 'PUT', body: settings }); showToast('Delivery settings saved', 'success'); load(); }
    catch (e) { showToast((e as Error).message, 'error'); }
    finally { setSavingSettings(false); }
  };

  const saveBand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bandForm) return;
    setSaving(true);
    try {
      await api(bandForm.id ? `/api/delivery/admin/bands/${bandForm.id}` : '/api/delivery/admin/bands', { method: bandForm.id ? 'PUT' : 'POST', body: bandForm.data });
      showToast('Distance band saved', 'success');
      setBandForm(null);
      load();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };

  const saveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optionForm) return;
    setSaving(true);
    try {
      await api(optionForm.id ? `/api/delivery/admin/options/${optionForm.id}` : '/api/delivery/admin/options', { method: optionForm.id ? 'PUT' : 'POST', body: optionForm.data });
      showToast('Delivery option saved', 'success');
      setOptionForm(null);
      load();
    } catch (err) { showToast((err as Error).message, 'error'); } finally { setSaving(false); }
  };

  const remove = async (kind: 'bands' | 'options', id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await api(`/api/delivery/admin/${kind}/${id}`, { method: 'DELETE' }); load(); } catch (e) { showToast((e as Error).message, 'error'); }
  };

  const runTest = async () => {
    try {
      const d = await api<{ quote: any }>('/api/delivery/quote', {
        method: 'POST',
        body: { mode: 'distance', county: tester.county, coordinates: tester.lat && tester.lng ? { lat: tester.lat, lng: tester.lng } : null, subtotal: tester.subtotal }
      });
      const q = d.quote;
      setTestResult(`${q.label}: ${q.fee === 0 ? 'FREE' : kes(q.fee)} for ~${q.distanceKm} km${q.estimated ? ' (county estimate)' : ''}${q.estimatedTime ? ` · ${q.estimatedTime}` : ''}`);
    } catch (e) { setTestResult((e as Error).message); }
  };

  if (!cfg) return <LoadingBlock />;
  const nextMin = cfg.bands.length ? Math.max(...cfg.bands.map((b) => b.maxKm ?? b.minKm)) : 0;

  return (
    <div className="space-y-8 animate-fadeInUp">
      <PageHeader icon={Truck} title="Delivery pricing" description="Delivery is priced by road distance from your office. Customers without an exact map pin are quoted from their county headquarters as an estimate. Fixed options such as store pickup appear alongside." />

      {/* Office & rules */}
      <section className="card card-pad space-y-5">
        <h3 className="font-bold text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-cyan-400" />Office location & rules</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Suspense fallback={<div className="location-map" />}>
              <MapPinPicker value={{ lat: settings.officeLat, lng: settings.officeLng }} center={{ lat: settings.officeLat, lng: settings.officeLng }} zoom={15} onChange={(p) => setSettings({ ...settings, officeLat: Math.round(p.lat * 1e6) / 1e6, officeLng: Math.round(p.lng * 1e6) / 1e6 })} label="Office location: click or drag the pin" />
            </Suspense>
            <p className="text-xs text-slate-500">Click the map or drag the pin onto your dispatch point.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            <Field label="Latitude" htmlFor="o-lat"><input id="o-lat" type="number" step="0.000001" value={settings.officeLat} onChange={(e) => setSettings({ ...settings, officeLat: Number(e.target.value) })} className="field-input font-mono" /></Field>
            <Field label="Longitude" htmlFor="o-lng"><input id="o-lng" type="number" step="0.000001" value={settings.officeLng} onChange={(e) => setSettings({ ...settings, officeLng: Number(e.target.value) })} className="field-input font-mono" /></Field>
            <Field label="Road distance factor" htmlFor="o-factor" className="sm:col-span-2" hint="Straight-line distance × this factor ≈ road distance. 1.3 suits Nairobi; increase for winding rural roads.">
              <input id="o-factor" type="number" min="1" max="3" step="0.05" value={settings.roadDistanceFactor} onChange={(e) => setSettings({ ...settings, roadDistanceFactor: Number(e.target.value) })} className="field-input" />
            </Field>
            <Field label="Beyond the last band" htmlFor="o-oor" className="sm:col-span-2" hint="Leave empty to refuse delivery beyond your bands (customers can still pick up or call). Or set a flat fee.">
              <input id="o-oor" type="number" min="0" value={settings.outOfRangeFee ?? ''} onChange={(e) => setSettings({ ...settings, outOfRangeFee: numOrNull(e.target.value) })} className="field-input" placeholder="Not delivered" />
            </Field>
            <button type="button" onClick={saveSettings} disabled={savingSettings} className="btn btn-primary sm:col-span-2"><Save className="w-4 h-4" />{savingSettings ? 'Saving…' : 'Save office & rules'}</button>
          </div>
        </div>
      </section>

      {/* Bands */}
      <section className="card overflow-hidden">
        <div className="card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">Distance bands</h3>
            <p className="text-sm text-slate-400">Each distance must fall into exactly one active band. The lower bound is included, the upper bound is not.</p>
          </div>
          <button type="button" onClick={() => setBandForm({ data: blankBand(nextMin) })} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add band</button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Band</th><th>Distance</th><th>Fee</th><th>Free over</th><th>ETA</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {cfg.bands.map((b) => (
                <tr key={b.id}>
                  <td><div className="font-semibold text-white">{b.name}</div>{b.description && <div className="text-xs text-slate-400">{b.description}</div>}</td>
                  <td className="whitespace-nowrap font-mono">{b.minKm} – {b.maxKm ?? '∞'} km</td>
                  <td className="whitespace-nowrap font-bold">{b.fee === 0 ? 'Free' : kes(b.fee)}</td>
                  <td className="whitespace-nowrap">{b.freeThreshold ? kes(b.freeThreshold) : '—'}</td>
                  <td className="whitespace-nowrap">{b.estimatedTime || '—'}</td>
                  <td><StatusBadge state={b.isActive ? 'active' : 'inactive'} /></td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" className="icon-button" aria-label={`Edit ${b.name}`} onClick={() => setBandForm({ id: b.id, data: { ...b } })}><Pencil className="w-4 h-4" /></button>
                    <button type="button" className="icon-button" aria-label={`Delete ${b.name}`} onClick={() => remove('bands', b.id, b.name)}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {!cfg.bands.length && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No bands yet — customers can only choose fixed options until you add one.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Options */}
      <section className="card overflow-hidden">
        <div className="card-pad flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2"><Store className="w-4 h-4 text-cyan-400" />Pickup & fixed-price options</h3>
            <p className="text-sm text-slate-400">Shown next to "Deliver to my address", e.g. free store pickup or a special courier rate.</p>
          </div>
          <button type="button" onClick={() => setOptionForm({ data: blankOption() })} className="btn btn-primary btn-sm"><Plus className="w-4 h-4" />Add option</button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Option</th><th>Type</th><th>Fee</th><th>ETA</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {cfg.options.map((o) => (
                <tr key={o.id}>
                  <td><div className="font-semibold text-white">{o.name}</div>{o.description && <div className="text-xs text-slate-400 max-w-md">{o.description}</div>}</td>
                  <td>{o.kind === 'pickup' ? 'Store pickup' : 'Fixed price'}</td>
                  <td className="font-bold whitespace-nowrap">{o.fee === 0 ? 'Free' : kes(o.fee)}</td>
                  <td className="whitespace-nowrap">{o.estimatedTime || '—'}</td>
                  <td><StatusBadge state={o.isActive ? 'active' : 'inactive'} /></td>
                  <td className="text-right whitespace-nowrap">
                    <button type="button" className="icon-button" aria-label={`Edit ${o.name}`} onClick={() => setOptionForm({ id: o.id, data: { ...o } })}><Pencil className="w-4 h-4" /></button>
                    <button type="button" className="icon-button" aria-label={`Delete ${o.name}`} onClick={() => remove('options', o.id, o.name)}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tester */}
      <section className="card card-pad space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Calculator className="w-4 h-4 text-cyan-400" />Test a quote</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <Field label="County" htmlFor="t-county"><select id="t-county" value={tester.county} onChange={(e) => setTester({ ...tester, county: e.target.value })} className="field-input">{KENYA_COUNTIES.map((c) => <option key={c.code}>{c.name}</option>)}</select></Field>
          <Field label="Latitude (optional)" htmlFor="t-lat"><input id="t-lat" value={tester.lat} onChange={(e) => setTester({ ...tester, lat: e.target.value })} className="field-input font-mono" placeholder="-1.2921" /></Field>
          <Field label="Longitude (optional)" htmlFor="t-lng"><input id="t-lng" value={tester.lng} onChange={(e) => setTester({ ...tester, lng: e.target.value })} className="field-input font-mono" placeholder="36.8219" /></Field>
          <Field label="Order value (KES)" htmlFor="t-sub"><input id="t-sub" type="number" value={tester.subtotal} onChange={(e) => setTester({ ...tester, subtotal: Number(e.target.value) })} className="field-input" /></Field>
          <button type="button" onClick={runTest} className="btn btn-secondary">Calculate</button>
        </div>
        {testResult && <p className="callout callout-info" role="status">{testResult}</p>}
      </section>

      {bandForm && (
        <Modal title={bandForm.id ? 'Edit distance band' : 'Add distance band'} onClose={() => setBandForm(null)} size="medium"
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setBandForm(null)}>Cancel</button><button type="submit" form="band-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save band'}</button></>}>
          <form id="band-form" onSubmit={saveBand} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" htmlFor="b-name" required className="sm:col-span-2"><input id="b-name" value={bandForm.data.name} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, name: e.target.value } })} className="field-input" placeholder="e.g. 5 - 15 km" required /></Field>
            <Field label="Description" htmlFor="b-desc" className="sm:col-span-2" hint="Shown to customers at checkout."><input id="b-desc" value={bandForm.data.description || ''} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, description: e.target.value } })} className="field-input" placeholder="e.g. Most Nairobi suburbs" /></Field>
            <Field label="From (km, included)" htmlFor="b-min" required><input id="b-min" type="number" min="0" step="0.1" value={bandForm.data.minKm} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, minKm: Number(e.target.value) } })} className="field-input" required /></Field>
            <Field label="Up to (km, excluded)" htmlFor="b-max" hint="Empty = no upper limit."><input id="b-max" type="number" min="0" step="0.1" value={bandForm.data.maxKm ?? ''} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, maxKm: numOrNull(e.target.value) } })} className="field-input" placeholder="∞" /></Field>
            <Field label="Fee (KES)" htmlFor="b-fee" required><input id="b-fee" type="number" min="0" value={bandForm.data.fee} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, fee: Number(e.target.value) } })} className="field-input" required /></Field>
            <Field label="Free when order is at least (KES)" htmlFor="b-free" hint="Optional."><input id="b-free" type="number" min="0" value={bandForm.data.freeThreshold ?? ''} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, freeThreshold: numOrNull(e.target.value) } })} className="field-input" /></Field>
            <Field label="Estimated delivery time" htmlFor="b-eta" className="sm:col-span-2"><input id="b-eta" value={bandForm.data.estimatedTime || ''} onChange={(e) => setBandForm({ ...bandForm, data: { ...bandForm.data, estimatedTime: e.target.value } })} className="field-input" placeholder="e.g. Same day" /></Field>
            <div className="sm:col-span-2"><Toggle checked={bandForm.data.isActive} onChange={(v) => setBandForm({ ...bandForm, data: { ...bandForm.data, isActive: v } })} label="Active" /></div>
          </form>
        </Modal>
      )}

      {optionForm && (
        <Modal title={optionForm.id ? 'Edit delivery option' : 'Add delivery option'} onClose={() => setOptionForm(null)} size="medium"
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setOptionForm(null)}>Cancel</button><button type="submit" form="option-form" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save option'}</button></>}>
          <form id="option-form" onSubmit={saveOption} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" htmlFor="op-name" required className="sm:col-span-2"><input id="op-name" value={optionForm.data.name} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, name: e.target.value } })} className="field-input" required /></Field>
            <Field label="Type" htmlFor="op-kind"><select id="op-kind" value={optionForm.data.kind} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, kind: e.target.value as any } })} className="field-input"><option value="pickup">Store pickup (no address needed)</option><option value="fixed">Fixed-price delivery</option></select></Field>
            <Field label="Fee (KES)" htmlFor="op-fee" required><input id="op-fee" type="number" min="0" value={optionForm.data.fee} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, fee: Number(e.target.value) } })} className="field-input" required /></Field>
            <Field label="Description" htmlFor="op-desc" className="sm:col-span-2" hint="E.g. pickup address and opening hours."><textarea id="op-desc" rows={2} value={optionForm.data.description || ''} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, description: e.target.value } })} className="field-input" /></Field>
            <Field label="Estimated time" htmlFor="op-eta"><input id="op-eta" value={optionForm.data.estimatedTime || ''} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, estimatedTime: e.target.value } })} className="field-input" /></Field>
            <Field label="Free when order is at least (KES)" htmlFor="op-free"><input id="op-free" type="number" min="0" value={optionForm.data.freeThreshold ?? ''} onChange={(e) => setOptionForm({ ...optionForm, data: { ...optionForm.data, freeThreshold: numOrNull(e.target.value) } })} className="field-input" /></Field>
            <div className="sm:col-span-2"><Toggle checked={optionForm.data.isActive} onChange={(v) => setOptionForm({ ...optionForm, data: { ...optionForm.data, isActive: v } })} label="Active" description="Inactive options are hidden from checkout." /></div>
          </form>
        </Modal>
      )}
    </div>
  );
};
