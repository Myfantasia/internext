import React from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';

export type Specs = Record<string, Record<string, string>>;

// Suggested sections per kind of product. Only names are suggested — values
// must come from the manufacturer's datasheet or the actual unit; leave a row
// out rather than guessing.
const TEMPLATES: Record<string, Record<string, string[]>> = {
  Computer: {
    General: ['Brand', 'Model', 'Condition', 'Warranty'],
    Performance: ['Processor', 'Memory', 'Storage', 'Graphics'],
    Display: ['Screen', 'Resolution', 'Panel', 'Touch'],
    Connectivity: ['Wi-Fi', 'Bluetooth', 'Ports'],
    Physical: ['Operating System', 'Battery', 'Weight', 'Dimensions']
  },
  Networking: {
    General: ['Brand', 'Model', 'Warranty'],
    Networking: ['Standard', 'Speed', 'Frequency Bands', 'Ports', 'PoE'],
    Physical: ['Mounting', 'Power', 'Dimensions']
  },
  CCTV: {
    General: ['Brand', 'Model', 'Warranty'],
    Camera: ['Resolution', 'Lens', 'Night Vision Range', 'Weather Rating'],
    Recording: ['Channels', 'Storage Included', 'Remote Viewing'],
    Physical: ['Power', 'Dimensions']
  },
  Service: {
    Service: ['What is included', 'Duration', 'Location', 'Workmanship Warranty']
  }
};

interface Props {
  value: Specs;
  onChange: (next: Specs) => void;
}

// Editable sections of label/value rows. Stored as { Section: { Label: Value } }.
export const SpecsEditor: React.FC<Props> = ({ value, onChange }) => {
  const sections = Object.entries(value);

  const renameSection = (oldName: string, newName: string) => {
    const next: Specs = {};
    for (const [k, v] of Object.entries(value)) next[k === oldName ? newName : k] = v;
    onChange(next);
  };
  const setRows = (section: string, rows: [string, string][]) => onChange({ ...value, [section]: Object.fromEntries(rows) });
  const removeSection = (section: string) => {
    const next = { ...value };
    delete next[section];
    onChange(next);
  };
  const addSection = () => {
    let name = 'New section';
    let i = 2;
    while (value[name]) name = `New section ${i++}`;
    onChange({ ...value, [name]: { '': '' } });
  };
  const applyTemplate = (key: string) => {
    const next: Specs = { ...value };
    for (const [section, labels] of Object.entries(TEMPLATES[key])) {
      next[section] = { ...(next[section] || {}) };
      for (const label of labels) if (!(label in next[section])) next[section][label] = '';
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400 flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" />Add suggested rows:</span>
        {Object.keys(TEMPLATES).map((k) => <button key={k} type="button" onClick={() => applyTemplate(k)} className="btn btn-secondary btn-sm">{k}</button>)}
      </div>
      {sections.length === 0 && <p className="text-sm text-slate-400">No specifications yet.</p>}
      {sections.map(([section, attrs], sIdx) => {
        const rows = Object.entries(attrs);
        return (
          <div key={sIdx} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={section} onChange={(e) => renameSection(section, e.target.value)} className="field-input !py-2 font-bold" aria-label="Section name" />
              <button type="button" onClick={() => removeSection(section)} className="icon-button shrink-0" aria-label={`Remove section ${section}`}><Trash2 className="w-4 h-4" /></button>
            </div>
            {rows.map(([label, val], rIdx) => (
              <div key={rIdx} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
                <input value={label} onChange={(e) => setRows(section, rows.map((r, i) => (i === rIdx ? [e.target.value, r[1]] : r)))} placeholder="Label (e.g. Processor)" className="field-input !py-2" aria-label="Specification label" />
                <input value={val} onChange={(e) => setRows(section, rows.map((r, i) => (i === rIdx ? [r[0], e.target.value] : r)))} placeholder="Value (leave empty if unknown)" className="field-input !py-2" aria-label={`${label || 'Specification'} value`} />
                <button type="button" onClick={() => setRows(section, rows.filter((_, i) => i !== rIdx))} className="icon-button" aria-label={`Remove ${label || 'row'}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setRows(section, [...rows, ['', '']])} className="btn btn-ghost btn-sm"><Plus className="w-4 h-4" />Add row</button>
          </div>
        );
      })}
      <button type="button" onClick={addSection} className="btn btn-secondary btn-sm"><Plus className="w-4 h-4" />Add section</button>
      <p className="field-hint">Only enter values you can confirm from the manufacturer's datasheet or the actual unit. Empty rows are not saved or shown.</p>
    </div>
  );
};

// Drops empty labels/values and empty sections before saving.
export function cleanSpecs(specs: Specs): Specs {
  const out: Specs = {};
  for (const [section, attrs] of Object.entries(specs)) {
    const name = section.trim();
    if (!name) continue;
    const rows = Object.entries(attrs).map(([k, v]) => [k.trim(), String(v).trim()]).filter(([k, v]) => k && v);
    if (rows.length) out[name] = Object.fromEntries(rows);
  }
  return out;
}
