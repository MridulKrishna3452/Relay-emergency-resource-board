import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Spinner } from './States';

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const el = ref.current;
    (el?.querySelector<HTMLElement>('textarea, input') ?? el?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-bold">
            {title}
          </h2>
          <button className="btn-ghost -mr-2 -mt-2 px-2" onClick={onClose} aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

/** A confirm dialog with an optional/required note textarea. */
export function NoteDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  noteLabel = 'Note (optional)',
  noteRequired = false,
  minLength = 3,
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  noteLabel?: string;
  noteRequired?: boolean;
  minLength?: number;
  danger?: boolean;
  busy?: boolean;
}) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const submit = () => {
    if (noteRequired && note.trim().length < minLength) {
      setError(`Please write at least ${minLength} characters.`);
      return;
    }
    if (note.length > 500) {
      setError('Note must be at most 500 characters.');
      return;
    }
    onConfirm(note.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description && <div className="text-sm text-slate-600">{description}</div>}
      <label htmlFor="dialog-note" className="label mt-4">
        {noteLabel}
        {noteRequired && <span className="text-red-600"> *</span>}
      </label>
      <textarea
        id="dialog-note"
        className="input min-h-[88px]"
        value={note}
        maxLength={500}
        onChange={(e) => {
          setNote(e.target.value);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'dialog-note-error' : undefined}
      />
      {error && (
        <p id="dialog-note-error" className="mt-1 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-secondary" onClick={onClose} disabled={busy}>
          Go back
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={submit} disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
