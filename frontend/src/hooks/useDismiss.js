import { useEffect, useRef } from 'react';

// For popovers, menus and dialogs. While `active` is true:
//   - pressing the mouse (or finger) outside `ref` calls onDismiss('outside')
//   - pressing Escape calls onDismiss('escape')
const useDismiss = (ref, onDismiss, active = true) => {
  // Keep the newest callback without re-attaching the listeners on every render.
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    if (!active) return undefined;

    const handlePointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) latest.current('outside');
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') latest.current('escape');
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, active]);
};

export { useDismiss };
