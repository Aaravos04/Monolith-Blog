import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

// A centered box over a dimmed page. It uses the browser's built-in <dialog>, which keeps
// keyboard focus inside the box, closes on Escape and dims everything behind it.
// The parent owns `open` and flips it to false in onClose.
const Modal = ({ open, onClose, title, children }) => {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // A click on the dimmed area outside the box lands on the <dialog> element itself.
  const handleClick = (e) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={handleClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md border border-ink bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-transparent hover:border-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
};

export default Modal;
