import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    subs.forEach((s) => s());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((s) => s());
  });
}

/** "Install app" button, shown only when the browser offers PWA installation. */
export function InstallButton({ className = 'btn-secondary' }: { className?: string }) {
  const [available, setAvailable] = useState(!!deferred);
  useEffect(() => {
    const s = () => setAvailable(!!deferred);
    subs.add(s);
    return () => void subs.delete(s);
  }, []);
  if (!available) return null;
  return (
    <button
      className={className}
      onClick={async () => {
        await deferred?.prompt();
        deferred = null;
        setAvailable(false);
      }}
    >
      <Download className="h-4 w-4" aria-hidden /> Install app
    </button>
  );
}
