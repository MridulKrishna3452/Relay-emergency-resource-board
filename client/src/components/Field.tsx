import type { ReactNode } from 'react';

/** Label + control + inline error, wired up with aria attributes. */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props to spread on an input so it's linked to its Field's error/hint. */
export const fieldProps = (id: string, error?: string) => ({
  id,
  name: id,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-error` : `${id}-hint`,
});
