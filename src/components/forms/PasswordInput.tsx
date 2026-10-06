import React, { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  hint?: string;
  /** Visually-hidden text appended to the toggle's label, e.g. "new password". */
  toggleLabel?: string;
  withIcon?: boolean;
}

// Password field with its own show/hide toggle. Each instance keeps separate
// visibility state, so "password" and "confirm password" toggle independently.
export const PasswordInput: React.FC<PasswordInputProps> = ({ label, error, hint, toggleLabel, withIcon = true, className = '', id, ...props }) => {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={inputId} className="field-label">{label}{props.required && <span className="text-rose-400"> *</span>}</label>
      <div className="relative">
        {withIcon && <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />}
        <input
          {...props}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`field-input ${withIcon ? 'pl-10' : ''} pr-12 ${error ? 'field-input-error' : ''} ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${toggleLabel || label.toLowerCase()}`}
          aria-pressed={visible}
          aria-controls={inputId}
          className="icon-button absolute right-1.5 top-1/2 -translate-y-1/2"
        >
          {visible ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="field-error" role="alert">{error}</p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
};
