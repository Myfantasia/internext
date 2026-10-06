import React, { useRef, useState } from 'react';
import { ImagePlus, X, Loader2, Upload, Image as ImageIcon } from 'lucide-react';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  value,
  onChange,
  label = 'Product image',
  hint = 'JPG, PNG, WebP or GIF up to 4 MB'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be 4 MB or smaller. Try a compressed JPG or WebP.');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/uploads/image', { method: 'POST', body });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.message || 'Upload failed. Try another image.');
        return;
      }
      setFileName(file.name);
      onChange(data.url);
    } catch {
      setError('Could not upload the image. Check that the API server is running.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void uploadFile(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-slate-300 font-bold">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      {value ? (
        <div className="relative rounded-2xl border border-slate-700 bg-slate-950 overflow-hidden">
          <img
            src={value}
            alt="Selected product preview"
            className="w-full h-44 object-contain bg-slate-950 p-3"
            onError={() => setError('This image could not be displayed. Please replace it with another file.')}
          />
          <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-slate-950/85 text-[11px] text-slate-300 truncate">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              {fileName || 'Uploaded product image'}
            </span>
          </div>
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-white text-[11px] font-bold"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setFileName('');
                setError('');
                onChange('');
              }}
              disabled={uploading}
              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-950 text-rose-400"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          disabled={uploading}
          className={`w-full rounded-2xl border-2 border-dashed px-4 py-8 flex flex-col items-center justify-center gap-2 transition-colors ${
            dragOver ? 'border-cyan-400 bg-cyan-950/40' : 'border-slate-700 bg-slate-950 hover:border-cyan-500 hover:bg-slate-900'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
          ) : (
            <span className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-cyan-400" />
            </span>
          )}
          <span className="text-sm font-bold text-white flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            {uploading ? 'Uploading…' : 'Click or drop an image here'}
          </span>
          <span className="text-[11px] text-slate-400">{hint}</span>
        </button>
      )}

      {error && <p className="text-[11px] text-rose-400 font-semibold">{error}</p>}
    </div>
  );
};
