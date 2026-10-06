import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Overlays (modals, drawers, sheets) render into <body> through a portal.
// Rendered in place, a `position: fixed` overlay gets trapped by any ancestor
// with a transform/filter/animation (e.g. the .animate-fadeInUp page wrapper)
// and ends up clipped to that ancestor's box instead of covering the screen.
export const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body);

// Reference-counted page scroll lock, so nested overlays (a modal opened from a
// drawer) don't unlock the page when the inner one closes. Compensates for the
// scrollbar width so the page doesn't jump sideways.
let lockCount = 0;
let saved: { overflow: string; paddingRight: string } | null = null;

export function useBodyScrollLock(active = true) {
  useEffect(() => {
    if (!active) return;
    if (lockCount === 0) {
      const body = document.body;
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0 && saved) {
        document.body.style.overflow = saved.overflow;
        document.body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}

// Closes an overlay on Escape.
export function useEscapeKey(onEscape: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onEscape, active]);
}
